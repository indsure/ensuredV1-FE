#!/usr/bin/env bash
#
# What the nightly timer actually runs. Both halves of the backup, in order,
# behind ONE healthcheck.
#
#   /opt/indsure/backup/nightly-backup.sh
#
# WHY A WRAPPER RATHER THAN TWO TIMERS WITH TWO CHECKS
# A restore needs the database and the documents from the same night: rows
# pointing at files that were never captured are not a usable backup. Running
# them as one unit makes that the default rather than a coincidence.
#
# It also fixes a masking problem. With one healthcheck and two independent
# jobs, whichever finishes last decides what the monitor sees, so a failed
# database dump followed by a fine storage sync reports green. Here the child
# scripts are told not to ping (HEALTHCHECK_URL is blanked for them) and this
# script pings exactly once, success only if BOTH succeeded.
#
# The database runs first because it is the half you cannot recreate. Documents
# can in principle be re-collected from customers; the ledger of who holds which
# policy cannot.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${BACKUP_ENV_FILE:-/etc/indsure/backup.env}"
[ -r "$CONFIG" ] || { echo "FATAL: cannot read config $CONFIG" >&2; exit 1; }

HC="$(grep -aE '^[[:space:]]*HEALTHCHECK_URL[[:space:]]*=' "$CONFIG" | head -1 \
      | sed -E 's/^[^=]*=[[:space:]]*//; s/^"//; s/"$//' | tr -d '\r')"

ping_hc() {
  [ -n "$HC" ] || return 0
  curl -fsS -m 10 --retry 3 "${HC}${1:-}" -o /dev/null || true
}

# Tell the monitor we started, so a run that hangs and never finishes shows as
# late rather than looking like it simply has not run yet.
ping_hc /start

STATUS=0
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

run_half() {
  local label="$1" script="$2"
  echo "=============== $label ==============="
  # Blanked so the child cannot ping: this script owns the verdict.
  if HEALTHCHECK_URL="" "$script" 2>&1 | tee -a "$LOG"; then
    echo "--- $label OK"
  else
    echo "--- $label FAILED"
    STATUS=1
  fi
}

run_half "DATABASE"  "$DIR/supabase-backup.sh"
run_half "DOCUMENTS" "$DIR/supabase-storage-backup.sh"

if [ "$STATUS" -eq 0 ]; then
  echo "NIGHTLY BACKUP OK (database + documents)"
  ping_hc
else
  echo "NIGHTLY BACKUP FAILED" >&2
  # Send the tail of the log with the failure ping so the alert email says what
  # broke, instead of only that something did.
  if [ -n "$HC" ]; then
    tail -c 9000 "$LOG" | curl -fsS -m 15 --retry 3 --data-binary @- "${HC}/fail" -o /dev/null || true
  fi
fi

exit "$STATUS"
