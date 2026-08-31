#!/usr/bin/env bash
#
# Interactive one-time setup for the nightly backup. Run it ON THE EC2 BOX:
#
#   sudo /opt/indsure/backup/setup-backup-env.sh
#
# Designed to be un-fumbleable. Every value is validated and re-prompted on a
# bad entry rather than exiting, whitespace and stray quotes are stripped, and
# the whole script is safe to run again as many times as you like. Nothing is
# written until all four answers are in hand, so quitting halfway changes
# nothing.
#
# It generates the encryption passphrase itself, writes /etc/indsure/backup.env
# and /etc/indsure/backup.passphrase as 600 root:root, and offers to run one
# real backup so a mistake surfaces now rather than at 02:30 tomorrow.
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run it with sudo:  sudo $0" >&2; exit 1; }

ENV_FILE=/etc/indsure/backup.env
PASS_FILE=/etc/indsure/backup.passphrase

# Strip whitespace and any quotes a copy-paste dragged along.
clean() { printf '%s' "$1" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//'; }

say() { printf '%s\n' "$*"; }
oops() { printf '      ** %s Try again.\n\n' "$*"; }

cat <<'INTRO'

  IndSure nightly backup setup
  ============================
  Three questions. Paste each value and press Enter.
  Nothing is saved until they are all answered, so Ctrl-C any time is safe.
  Get one wrong and it just asks again.

INTRO

# ── 1. Supabase session pooler ───────────────────────────────────────────────
# The app on this box already holds working credentials. pg_dump cannot use the
# 6543 transaction pooler they point at, but the session pooler on 5432 takes
# the same user and password, so the URL is derivable. Offering that removes the
# single most error-prone step in this setup: Supabase shows the connection
# string with a [YOUR-PASSWORD] placeholder, and hand-filling it is where people
# come unstuck. The typed path stays for anyone whose password has since changed.
APP_ENV=/home/ubuntu/ensuredV1-FE/.env
DERIVED=""
if [ -r "$APP_ENV" ]; then
  app_url="$(grep -aE '^[[:space:]]*DATABASE_URL[[:space:]]*=' "$APP_ENV" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//; s/^"//; s/"$//' | tr -d '')"
  case "$app_url" in
    postgres*://*) DERIVED="$(printf '%s' "$app_url" | sed -E 's/:6543/:5432/' | sed -E 's/\?.*$//')" ;;
  esac
fi

DB_URL=""
if [ -n "$DERIVED" ]; then
  say "1 of 3  Database connection"
  say "        Found the app's credentials on this box. Testing them on port 5432..."
  if psql "$DERIVED" -tAc "select 1" >/dev/null 2>&1; then
    say "        They work. Using them, nothing for you to paste."
    say ""
    DB_URL="$DERIVED"
  else
    say "        They did not work, so it will have to be pasted after all."
    say ""
  fi
fi

while [ -z "$DB_URL" ]; do
  say "1 of 3  Supabase connection string (SESSION pooler, port 5432)"
  say "        Dashboard > Connect > Session pooler. Replace [YOUR-PASSWORD]"
  say "        with the real database password."
  read -rsp "        Paste it: " raw_in; echo; echo
  cand="$(clean "$raw_in")"
  [ -n "$cand" ]                    || { oops "Nothing pasted.";                                continue; }
  case "$cand" in postgres*://*) ;; *) oops "That is not a postgres:// URL.";                   continue;; esac
  case "$cand" in *:6543*) oops "That is the 6543 transaction pooler, not the session one.";    continue;; esac
  case "$cand" in *:5432*) ;; *) oops "No port 5432 in that URL.";                              continue;; esac
  case "$cand" in *YOUR-PASSWORD*) oops "The [YOUR-PASSWORD] placeholder is still in there.";   continue;; esac
  say "        Testing it..."
  if psql "$cand" -tAc "select 1" >/dev/null 2>&1; then DB_URL="$cand"; say "        Works."; echo
  else oops "Could not connect. Usually the password is wrong."; fi
done

# ── 2. Account ID ────────────────────────────────────────────────────────────
while :; do
  say "2 of 3  Cloudflare account ID"
  say "        The whole endpoint URL is fine, it will pull the ID out."
  read -rp  "        Paste it: " raw; echo
  ACCOUNT_ID="$(clean "$raw")"
  # Accept the full https://<id>.r2.cloudflarestorage.com endpoint too.
  case "$ACCOUNT_ID" in
    http*) ACCOUNT_ID="$(printf '%s' "$ACCOUNT_ID" | sed -E 's#^https?://([^.]+)\..*#\1#')" ;;
  esac
  if printf '%s' "$ACCOUNT_ID" | grep -qE '^[0-9a-f]{32}$'; then break; fi
  oops "That is not a 32-character account ID."
done

# ── 3. R2 API token ──────────────────────────────────────────────────────────
while :; do
  say "3 of 3  R2 Access Key ID  (32 characters)"
  read -rp "        Paste it: " raw; echo
  AKID="$(clean "$raw")"
  if printf '%s' "$AKID" | grep -qE '^[0-9a-f]{32}$'; then break; fi
  case "$AKID" in
    cfat_*) oops "That is the Token value. Scroll down to 'Access Key ID'." ;;
    *)      oops "That is not a 32-character Access Key ID." ;;
  esac
done

while :; do
  say "        R2 Secret Access Key  (64 characters, hidden as you paste)"
  read -rsp "        Paste it: " raw; echo; echo
  SAK="$(clean "$raw")"
  if printf '%s' "$SAK" | grep -qE '^[0-9a-f]{64}$'; then break; fi
  oops "That is not a 64-character Secret Access Key."
done

# ── 4. Healthcheck ───────────────────────────────────────────────────────────
while :; do
  say "Optional  healthchecks.io ping URL   (press Enter to skip)"
  read -rp "        Paste it: " raw; echo
  HC_URL="$(clean "$raw")"
  [ -z "$HC_URL" ] && break
  case "$HC_URL" in http*) break ;; *) oops "That is not a URL." ;; esac
done

say "Writing the config..."

umask 077
mkdir -p /etc/indsure
PASSPHRASE="$(openssl rand -base64 48 | tr -d '\n')"
printf '%s\n' "$PASSPHRASE" > "$PASS_FILE"; chmod 600 "$PASS_FILE"; chown root:root "$PASS_FILE"

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

say "Checking the R2 bucket..."
if AWS_ACCESS_KEY_ID="$AKID" AWS_SECRET_ACCESS_KEY="$SAK" AWS_DEFAULT_REGION=auto \
   aws s3 ls "s3://indsure-backups" --endpoint-url "https://$ACCOUNT_ID.r2.cloudflarestorage.com" >/dev/null 2>&1; then
  say "  R2 OK."
else
  say "  Could not reach the bucket with those keys."
  say "  Usually the token is scoped to the wrong bucket, or the account ID is off."
  say "  Config was still written; fix the keys and run this again."
fi

cat <<EOF

  ================= SAVE THIS NOW. IT IS SHOWN ONCE. =================

  $PASSPHRASE

  Put it in your password manager before you do anything else.
  Every backup is encrypted with it. Without it they are unreadable,
  and the copy on this box dies with the box.
  ====================================================================

EOF

read -rp "Run one real backup now to prove it all works? [Y/n] " go
if [ "${go,,}" != "n" ]; then
  echo
  /opt/indsure/backup/supabase-backup.sh
  rc=$?
  echo
  if [ $rc -eq 0 ]; then
    say "Backup succeeded. Last step, turn on the nightly timer:"
    say "  sudo systemctl enable --now supabase-backup.timer"
  else
    say "Backup failed (exit $rc). Nothing is broken; send the output above for a diagnosis."
  fi
fi
