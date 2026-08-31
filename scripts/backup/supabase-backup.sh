#!/usr/bin/env bash
#
# Nightly logical backup of the IndSure Supabase Postgres database.
#
# Dumps -> verifies -> encrypts (GPG AES256) -> uploads to S3-compatible
# object storage (Cloudflare R2) -> prunes old copies -> pings a healthcheck.
#
# The dump is encrypted before it leaves this machine, so the storage bucket
# never holds readable client PII.
#
# Run via the systemd timer (see supabase-backup.timer), not by hand.

set -Eeuo pipefail

CONF="${BACKUP_ENV_FILE:-/etc/indsure/backup.env}"
if [ ! -r "$CONF" ]; then
  echo "FATAL: cannot read config $CONF" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$CONF"
set +a

: "${R2_BUCKET:?R2_BUCKET must be set in $CONF}"
: "${R2_ENDPOINT:?R2_ENDPOINT must be set in $CONF}"
: "${GPG_PASSPHRASE_FILE:?GPG_PASSPHRASE_FILE must be set in $CONF}"

LOCAL_DIR="${LOCAL_DIR:-/var/backups/supabase}"
LOCAL_KEEP="${LOCAL_KEEP:-3}"
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-90}"
PREFIX="${R2_PREFIX:-supabase}"

# Supabase's transaction pooler (port 6543) cannot serve pg_dump. Fall back to
# rewriting the app's DATABASE_URL onto the session pooler (5432) if a dedicated
# SUPABASE_DB_URL was not supplied.
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "FATAL: set SUPABASE_DB_URL (session pooler, port 5432) in $CONF" >&2
    exit 1
  fi
  SUPABASE_DB_URL="${DATABASE_URL/:6543\//:5432/}"
  SUPABASE_DB_URL="${SUPABASE_DB_URL/\?pgbouncer=true&/\?}"
  SUPABASE_DB_URL="${SUPABASE_DB_URL/\?pgbouncer=true/}"
fi

case "$SUPABASE_DB_URL" in
  *:6543/*)
    echo "FATAL: SUPABASE_DB_URL points at the transaction pooler (6543)." >&2
    echo "       pg_dump needs the session pooler on port 5432." >&2
    exit 1
    ;;
esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d -t supabase-backup.XXXXXXXX)"
ARCHIVE="$LOCAL_DIR/indsure-${STAMP}.tar.gz.gpg"
STATUS="fail"

log()  { printf '%s  %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
warn() { printf '%s  WARN: %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }

ping_health() {
  [ -n "${HEALTHCHECK_URL:-}" ] || return 0
  local suffix=""
  [ "$1" = "fail" ] && suffix="/fail"
  curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}${suffix}" -o /dev/null || true
}

cleanup() {
  rm -rf "$WORK"
  ping_health "$STATUS"
  [ "$STATUS" = "ok" ] || log "BACKUP FAILED"
}
trap cleanup EXIT

# --- preflight -------------------------------------------------------------
# A pg_dump older than the server refuses to run. Catch it here with a message
# that says what to install, rather than failing cryptically at 3am.
for bin in pg_dump pg_restore psql gpg aws curl tar; do
  command -v "$bin" >/dev/null || { echo "FATAL: $bin not installed" >&2; exit 1; }
done
[ -r "$GPG_PASSPHRASE_FILE" ] || { echo "FATAL: cannot read $GPG_PASSPHRASE_FILE" >&2; exit 1; }

SERVER_MAJOR="$(psql "$SUPABASE_DB_URL" -tAc 'SHOW server_version;' | cut -d. -f1)"
CLIENT_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
if [ "$CLIENT_MAJOR" -lt "$SERVER_MAJOR" ]; then
  echo "FATAL: pg_dump is v$CLIENT_MAJOR but the server is v$SERVER_MAJOR." >&2
  echo "       Install postgresql-client-$SERVER_MAJOR and retry." >&2
  exit 1
fi
log "connected: server v$SERVER_MAJOR, pg_dump v$CLIENT_MAJOR"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"
# gpg refuses to run without a writable home; systemd's ProtectHome hides /root.
export GNUPGHOME="${GNUPGHOME:-$LOCAL_DIR/.gnupg}"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"

# --- dump ------------------------------------------------------------------
# public  = application data, must succeed.
# auth    = Supabase Auth users; without it a restore leaves nobody able to
#           log in. Treated as required-but-warnable because the pooler role
#           may lack rights on some internal objects.
# storage = object metadata only. The file blobs themselves live in Supabase
#           Storage and are NOT covered by this backup.
dump_schema() {
  # Separate statements on purpose. `local` is a builtin, so bash expands ALL
  # its arguments before assigning any of them: writing this as one line meant
  # ${schema} was expanded before `schema` existed, and `set -u` killed the run.
  local schema="$1"
  local required="$2"
  local out="$WORK/${schema}.dump"
  log "dumping schema: $schema"
  if pg_dump "$SUPABASE_DB_URL" \
      --schema="$schema" \
      --format=custom \
      --no-owner --no-privileges \
      --quote-all-identifiers \
      --file="$out" 2>"$WORK/${schema}.err"; then
    pg_restore --list "$out" >/dev/null 2>&1 \
      || { echo "FATAL: $schema dump is corrupt" >&2; exit 1; }
    log "  ok: $(du -h "$out" | cut -f1)"
    return 0
  fi
  if [ "$required" = "yes" ]; then
    echo "FATAL: dump of required schema '$schema' failed:" >&2
    sed 's/^/       /' "$WORK/${schema}.err" >&2
    exit 1
  fi
  warn "optional schema '$schema' not dumped: $(tail -1 "$WORK/${schema}.err")"
  rm -f "$out"
  return 0
}

dump_schema public  yes
dump_schema auth    yes
dump_schema storage no

psql "$SUPABASE_DB_URL" -tAc \
  "select 'server_version='||current_setting('server_version')" > "$WORK/META.txt"
{
  echo "taken_at_utc=$STAMP"
  echo "host=$(hostname)"
  echo "schemas=$(cd "$WORK" && ls ./*.dump | tr '\n' ' ')"
} >> "$WORK/META.txt"

# --- package + encrypt -----------------------------------------------------
log "encrypting"
tar -czf "$WORK/bundle.tar.gz" -C "$WORK" META.txt $(cd "$WORK" && ls ./*.dump)
gpg --batch --yes --pinentry-mode loopback \
    --passphrase-file "$GPG_PASSPHRASE_FILE" \
    --symmetric --cipher-algo AES256 \
    --output "$ARCHIVE" "$WORK/bundle.tar.gz"
chmod 600 "$ARCHIVE"
log "archive: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# --- upload ----------------------------------------------------------------
# Newer AWS CLI versions send checksum headers R2 can reject; this keeps them
# to only where the protocol requires them.
export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
export AWS_EC2_METADATA_DISABLED=true
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

KEY="$PREFIX/$(date -u +%Y/%m)/$(basename "$ARCHIVE")"
log "uploading s3://$R2_BUCKET/$KEY"
aws s3 cp "$ARCHIVE" "s3://$R2_BUCKET/$KEY" --endpoint-url "$R2_ENDPOINT" --only-show-errors
aws s3api head-object --bucket "$R2_BUCKET" --key "$KEY" \
    --endpoint-url "$R2_ENDPOINT" >/dev/null
log "upload verified"

# --- prune -----------------------------------------------------------------
ls -1t "$LOCAL_DIR"/indsure-*.tar.gz.gpg 2>/dev/null \
  | tail -n +$((LOCAL_KEEP + 1)) | xargs -r rm -f

CUTOFF="$(date -u -d "$REMOTE_KEEP_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
if [ -n "$CUTOFF" ]; then
  aws s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$PREFIX/" \
      --endpoint-url "$R2_ENDPOINT" \
      --query "Contents[?LastModified<'$CUTOFF'].Key" --output text 2>/dev/null \
    | tr '\t' '\n' | grep -v '^None$' | grep . \
    | while read -r old; do
        log "pruning $old"
        aws s3 rm "s3://$R2_BUCKET/$old" --endpoint-url "$R2_ENDPOINT" --only-show-errors
      done || true
fi

STATUS="ok"
log "BACKUP OK"
