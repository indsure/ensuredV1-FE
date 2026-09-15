#!/usr/bin/env bash
#
# Restore an encrypted IndSure Supabase backup.
#
#   ./supabase-restore.sh <archive.tar.gz.gpg> <target-database-url> [--schemas public,auth]
#
# The archive may be a local path or an s3:// key; s3:// is fetched first.
# Refuses to write to the live production database unless ALLOW_PROD=1 is set,
# because the usual reason to run this is a drill, not an emergency.

set -Eeuo pipefail

ARCHIVE="${1:-}"
TARGET="${2:-}"
SCHEMAS="public,auth,storage"

shift 2 2>/dev/null || true
while [ $# -gt 0 ]; do
  case "$1" in
    --schemas) SCHEMAS="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$ARCHIVE" ] || [ -z "$TARGET" ]; then
  sed -n '2,12p' "$0" | sed 's/^# \?//'
  exit 1
fi

CONF="${BACKUP_ENV_FILE:-/etc/indsure/backup.env}"
if [ -r "$CONF" ]; then set -a; . "$CONF"; set +a; fi
: "${GPG_PASSPHRASE_FILE:?GPG_PASSPHRASE_FILE must be set}"

if [ "${ALLOW_PROD:-0}" != "1" ] && [ -n "${DATABASE_URL:-}" ]; then
  live_host="$(printf '%s' "$DATABASE_URL"  | sed -E 's#.*@([^:/?]+).*#\1#')"
  tgt_host="$(printf '%s' "$TARGET"        | sed -E 's#.*@([^:/?]+).*#\1#')"
  live_user="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*://([^:]+):.*#\1#')"
  tgt_user="$(printf '%s' "$TARGET"        | sed -E 's#.*://([^:]+):.*#\1#')"
  if [ "$live_host" = "$tgt_host" ] && [ "$live_user" = "$tgt_user" ]; then
    echo "REFUSING: target looks like the live production database." >&2
    echo "          Restore into a fresh project first. Set ALLOW_PROD=1 to override." >&2
    exit 1
  fi
fi

WORK="$(mktemp -d -t supabase-restore.XXXXXXXX)"
trap 'rm -rf "$WORK"' EXIT

if [ "${ARCHIVE#s3://}" != "$ARCHIVE" ]; then
  : "${R2_ENDPOINT:?R2_ENDPOINT needed to fetch s3:// archives}"
  export AWS_EC2_METADATA_DISABLED=true AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
  echo "fetching $ARCHIVE"
  aws s3 cp "$ARCHIVE" "$WORK/archive.gpg" --endpoint-url "$R2_ENDPOINT" --only-show-errors
  ARCHIVE="$WORK/archive.gpg"
fi

echo "decrypting"
gpg --batch --yes --pinentry-mode loopback \
    --passphrase-file "$GPG_PASSPHRASE_FILE" \
    --decrypt --output "$WORK/bundle.tar.gz" "$ARCHIVE"
tar -xzf "$WORK/bundle.tar.gz" -C "$WORK"

echo "--- backup metadata ---"
cat "$WORK/META.txt"
echo "-----------------------"

# auth must go back before public: public tables carry FKs onto auth.users.
for schema in $(printf '%s' "$SCHEMAS" | tr ',' ' '); do
  dump="$WORK/${schema}.dump"
  [ -f "$dump" ] || { echo "skip $schema (not in archive)"; continue; }
  echo "restoring $schema"
  pg_restore --dbname="$TARGET" \
    --no-owner --no-privileges \
    --clean --if-exists \
    "$dump" 2>&1 | sed 's/^/    /' || true
done

echo
echo "restore finished. Verify before trusting it:"
echo "  psql \"\$TARGET\" -c 'select count(*) from public.agents;'"
echo "  psql \"\$TARGET\" -c 'select count(*) from auth.users;'"
