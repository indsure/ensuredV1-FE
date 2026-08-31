#!/usr/bin/env bash
#
# Interactive one-time setup for the nightly backup. Run it ON THE EC2 BOX.
#
#   sudo /opt/indsure/backup/setup-backup-env.sh
#
# It prompts for the four values only you can supply, generates the encryption
# passphrase for you, writes /etc/indsure/backup.env and
# /etc/indsure/backup.passphrase with 600 root:root, and offers to run one
# backup so you find out it works now rather than at 02:30 tomorrow.
#
# Nothing typed here is echoed for the secret fields, and nothing is written
# anywhere except the two files above.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }

ENV_FILE=/etc/indsure/backup.env
PASS_FILE=/etc/indsure/backup.passphrase

if [ -f "$ENV_FILE" ]; then
  read -rp "$ENV_FILE already exists. Overwrite? [y/N] " ans
  [ "${ans,,}" = "y" ] || { echo "Left alone."; exit 0; }
fi

echo
echo "1/4  Supabase SESSION pooler URL."
echo "     Supabase Dashboard > Connect > Session pooler. It must be port 5432,"
echo "     NOT the 6543 the app uses: the transaction pooler cannot serve pg_dump."
read -rsp "     Paste it: " DB_URL; echo

case "$DB_URL" in
  *:5432/*) ;;
  *:6543/*) echo "     That is the 6543 transaction pooler. pg_dump cannot use it." >&2; exit 1 ;;
  *) echo "     That does not look like a postgres URL with a port." >&2; exit 1 ;;
esac

echo
echo "2/4  Cloudflare R2 account ID."
echo "     R2 > Overview, in the S3 API endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
read -rp "     Account ID: " ACCOUNT_ID
[ -n "$ACCOUNT_ID" ] || { echo "     Required." >&2; exit 1; }

echo
echo "3/4  R2 API token, scoped to Object Read & Write on indsure-backups."
read -rp  "     Access Key ID:     " AKID
read -rsp "     Secret Access Key: " SAK; echo
[ -n "$AKID" ] && [ -n "$SAK" ] || { echo "     Both are required." >&2; exit 1; }

echo
echo "4/4  healthchecks.io ping URL (optional, press Enter to skip)."
read -rp "     Ping URL: " HC_URL

# Generated rather than chosen: a passphrase you invent is a passphrase you reuse.
PASSPHRASE="$(openssl rand -base64 48 | tr -d '\n')"
umask 077
mkdir -p /etc/indsure
printf '%s\n' "$PASSPHRASE" > "$PASS_FILE"
chmod 600 "$PASS_FILE"; chown root:root "$PASS_FILE"

cat > "$ENV_FILE" <<EOF
# Written by setup-backup-env.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Never commit this.
SUPABASE_DB_URL=$DB_URL
R2_BUCKET=indsure-backups
R2_ENDPOINT=https://$ACCOUNT_ID.r2.cloudflarestorage.com
R2_PREFIX=supabase
AWS_ACCESS_KEY_ID=$AKID
AWS_SECRET_ACCESS_KEY=$SAK
AWS_DEFAULT_REGION=auto
GPG_PASSPHRASE_FILE=$PASS_FILE
LOCAL_KEEP=3
REMOTE_KEEP_DAYS=90
HEALTHCHECK_URL=$HC_URL
EOF
chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"

cat <<EOF

Wrote $ENV_FILE and $PASS_FILE, both 600 root:root.

  ================= SAVE THIS NOW, IT IS SHOWN ONCE =================
  Encryption passphrase:

  $PASSPHRASE

  Put it in your password manager. Every backup is encrypted with it.
  If this box dies and you do not have it, every backup is unreadable
  and the backups were pointless. It is also in $PASS_FILE, which
  lives on the same box the backups protect you from losing.
  ===================================================================

EOF

read -rp "Run one backup now to prove it works? [Y/n] " go
if [ "${go,,}" != "n" ]; then
  echo
  /opt/indsure/backup/supabase-backup.sh
  echo
  echo "If that ended with an upload line, you are done. Enable the nightly timer:"
  echo "  sudo systemctl enable --now supabase-backup.timer"
  echo "  systemctl list-timers supabase-backup.timer"
fi
