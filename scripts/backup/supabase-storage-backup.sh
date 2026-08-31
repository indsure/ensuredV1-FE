#!/usr/bin/env bash
#
# Backs up the Supabase Storage FILE BLOBS. The database backup
# (supabase-backup.sh) dumps the `storage` schema, which is metadata only:
# restore that alone and every policy row points at a document that is gone.
# This is the other half.
#
#   /opt/indsure/backup/supabase-storage-backup.sh
#
# WHY AN OBJECT MIRROR AND NOT A NIGHTLY TARBALL
# The database dump has to be a point-in-time snapshot, so a fresh copy every
# night is right. Blobs are different: a policy PDF never changes, it only
# appears or disappears. Re-uploading all 68MB nightly for 90 days would put
# 6GB into R2 to hold 68MB of distinct data, and the free tier is 10GB. So each
# object is encrypted and uploaded ONCE and later runs skip it. A nightly
# manifest records what the set looked like on any given day, which is the part
# a restore actually needs.
#
# DELETIONS
# A file removed at source is NOT dropped from the backup the same night, or a
# mistaken delete would be unrecoverable, which is most of the point of having
# backups. It is kept for REMOTE_KEEP_DAYS after it first goes missing, tracked
# in a state file, then purged. That matches the database retention and keeps
# the consumer "delete my policy" promise honest on a defined horizon.
set -uo pipefail

CONFIG="${BACKUP_ENV_FILE:-/etc/indsure/backup.env}"
[ -r "$CONFIG" ] || { echo "FATAL: cannot read config $CONFIG" >&2; exit 1; }
set -a; . "$CONFIG"; set +a

APP_ENV="${APP_ENV:-/home/ubuntu/ensuredV1-FE/.env}"
[ -r "$APP_ENV" ] || { echo "FATAL: cannot read $APP_ENV for the Supabase keys" >&2; exit 1; }
readvar() {
  grep -aE "^[[:space:]]*$1[[:space:]]*=" "$APP_ENV" | head -1 \
    | sed -E 's/^[^=]*=[[:space:]]*//; s/^"//; s/"$//' | tr -d '\r'
}
SUPABASE_URL="$(readvar SUPABASE_URL)"
SERVICE_KEY="$(readvar SUPABASE_SERVICE_ROLE_KEY)"
if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in $APP_ENV" >&2
  exit 1
fi

: "${SUPABASE_DB_URL:?}" "${R2_BUCKET:?}" "${R2_ENDPOINT:?}" "${GPG_PASSPHRASE_FILE:?}"
PREFIX="${R2_STORAGE_PREFIX:-storage}"
KEEP_DAYS="${REMOTE_KEEP_DAYS:-90}"
LOCAL_DIR="${LOCAL_DIR:-/var/backups/supabase}"

log()  { echo "$(date -u +%H:%M:%SZ)  $*"; }
warn() { echo "$(date -u +%H:%M:%SZ)  WARN: $*" >&2; }
ping_hc() {
  [ -n "${HEALTHCHECK_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL}${1:-}" -o /dev/null || true
}

for bin in psql gpg aws curl; do
  command -v "$bin" >/dev/null || { echo "FATAL: $bin is not installed." >&2; exit 1; }
done

mkdir -p "$LOCAL_DIR"; chmod 700 "$LOCAL_DIR"
export GNUPGHOME="${GNUPGHOME:-$LOCAL_DIR/.gnupg}"
mkdir -p "$GNUPGHOME"; chmod 700 "$GNUPGHOME"

WORK="$(mktemp -d)"
# Decrypted policy documents pass through here. Shred them, never just unlink.
cleanup() { find "$WORK" -type f -exec shred -u {} + 2>/dev/null; rm -rf "$WORK"; }
trap 'rc=$?; cleanup; if [ $rc -ne 0 ]; then ping_hc /fail; fi; exit $rc' EXIT

aws_s3() { aws "$@" --endpoint-url "$R2_ENDPOINT" --only-show-errors; }

# URL-encode a storage path for the REST call. Slashes stay as separators.
urlenc() {
  printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' \
    -e 's/?/%3F/g' -e 's/&/%26/g' -e 's/+/%2B/g'
}

# 1. The authoritative index of what exists, straight from the database.
log "listing objects at source"
if ! psql "$SUPABASE_DB_URL" -tAF $'\t' -c \
  "SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint,0)
     FROM storage.objects
    WHERE name IS NOT NULL AND name <> ''
    ORDER BY bucket_id, name" > "$WORK/index.tsv"; then
  echo "FATAL: could not list storage.objects" >&2; exit 1
fi
TOTAL=$(wc -l < "$WORK/index.tsv")
log "  $TOTAL objects"
# Zero is far more likely to be a broken query than an empty bucket, and acting
# on it would purge the entire backup. Refuse.
[ "$TOTAL" -gt 0 ] || { echo "FATAL: zero objects listed; refusing to run" >&2; exit 1; }

# 2. What is already backed up.
log "listing what R2 already holds"
aws_s3 s3 ls "s3://$R2_BUCKET/$PREFIX/blobs/" --recursive 2>/dev/null \
  | awk '{ $1=""; $2=""; $3=""; sub(/^ +/,""); print }' | sort > "$WORK/have.txt" || true
HAVE=$(wc -l < "$WORK/have.txt")
log "  $HAVE already stored"

# 3. Upload whatever is missing.
NEW=0; FAILED=0; SKIPPED=0
while IFS=$'\t' read -r bucket name size; do
  [ -n "$bucket" ] && [ -n "$name" ] || continue
  key="$PREFIX/blobs/$bucket/$name.gpg"
  if grep -Fqx "$key" "$WORK/have.txt"; then
    SKIPPED=$((SKIPPED+1)); continue
  fi

  # The service key reads any bucket, public or not. --fail so that an HTML
  # error page is never silently stored in place of a document.
  if ! curl -fsS -m 300 \
        -H "Authorization: Bearer $SERVICE_KEY" \
        "$SUPABASE_URL/storage/v1/object/$bucket/$(urlenc "$name")" \
        -o "$WORK/blob" 2>"$WORK/curl.err"; then
    warn "download failed: $bucket/$name"
    FAILED=$((FAILED+1)); continue
  fi

  # An empty file where a document should be is a failure, not an upload.
  got=$(stat -c%s "$WORK/blob" 2>/dev/null || echo 0)
  if [ "$got" -eq 0 ]; then
    warn "empty download: $bucket/$name"
    FAILED=$((FAILED+1)); rm -f "$WORK/blob"; continue
  fi

  if ! gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file "$GPG_PASSPHRASE_FILE" -o "$WORK/blob.gpg" "$WORK/blob" 2>/dev/null; then
    warn "encrypt failed: $bucket/$name"
    FAILED=$((FAILED+1)); shred -u "$WORK/blob" 2>/dev/null; continue
  fi
  shred -u "$WORK/blob" 2>/dev/null

  if aws_s3 s3 cp "$WORK/blob.gpg" "s3://$R2_BUCKET/$key"; then
    NEW=$((NEW+1))
  else
    warn "upload failed: $key"
    FAILED=$((FAILED+1))
  fi
  rm -f "$WORK/blob.gpg"
done < "$WORK/index.tsv"
log "  uploaded $NEW, already had $SKIPPED, failed $FAILED"

# 4. Tonight's manifest, so a restore knows what the set looked like.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if gpg --batch --yes --symmetric --cipher-algo AES256 \
     --passphrase-file "$GPG_PASSPHRASE_FILE" -o "$WORK/index.tsv.gpg" "$WORK/index.tsv" 2>/dev/null; then
  aws_s3 s3 cp "$WORK/index.tsv.gpg" \
    "s3://$R2_BUCKET/$PREFIX/manifests/$(date -u +%Y/%m)/manifest-$STAMP.tsv.gpg" && log "manifest stored"
fi

# 5. Purge blobs that have been gone from source longer than the window.
# The state lives in R2, not on the box, so a rebuilt box does not forget and
# restart the clock, which would keep deleted documents for ever.
awk -F'\t' -v p="$PREFIX" '{print p"/blobs/"$1"/"$2".gpg"}' "$WORK/index.tsv" | sort > "$WORK/want.txt"
comm -13 "$WORK/want.txt" "$WORK/have.txt" > "$WORK/gone.txt"
GONE=$(wc -l < "$WORK/gone.txt")
if [ "$GONE" -gt 0 ]; then
  STATE_KEY="$PREFIX/_state/missing-since.tsv"
  aws_s3 s3 cp "s3://$R2_BUCKET/$STATE_KEY" "$WORK/state.old" 2>/dev/null || : > "$WORK/state.old"
  [ -f "$WORK/state.old" ] || : > "$WORK/state.old"
  TODAY=$(date -u +%s); PURGED=0
  : > "$WORK/state.new"
  while read -r key; do
    [ -n "$key" ] || continue
    since=$(awk -F'\t' -v k="$key" '$1==k{print $2}' "$WORK/state.old" | head -1)
    [ -n "$since" ] || since=$TODAY
    age_days=$(( (TODAY - since) / 86400 ))
    if [ "$age_days" -ge "$KEEP_DAYS" ]; then
      aws_s3 s3 rm "s3://$R2_BUCKET/$key" && PURGED=$((PURGED+1))
    else
      printf '%s\t%s\n' "$key" "$since" >> "$WORK/state.new"
    fi
  done < "$WORK/gone.txt"
  aws_s3 s3 cp "$WORK/state.new" "s3://$R2_BUCKET/$STATE_KEY"
  log "  $GONE gone from source, $PURGED past $KEEP_DAYS days and purged"
fi

# Old manifests age out on the same clock as the database dumps.
CUTOFF="$(date -u -d "$KEEP_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
if [ -n "$CUTOFF" ]; then
  aws s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$PREFIX/manifests/" \
      --endpoint-url "$R2_ENDPOINT" --query "Contents[?LastModified<'$CUTOFF'].Key" \
      --output text 2>/dev/null \
    | tr '\t' '\n' | while read -r old; do
        if [ -n "$old" ] && [ "$old" != "None" ]; then aws_s3 s3 rm "s3://$R2_BUCKET/$old"; fi
      done
fi

if [ "$FAILED" -gt 0 ]; then
  echo "STORAGE BACKUP FINISHED WITH $FAILED FAILURES" >&2
  exit 1
fi
log "STORAGE BACKUP OK"
ping_hc
