#!/usr/bin/env bash
# Invokes an OpenReply cron endpoint against the local Next.js server.
#
# The app ships /api/cron/* routes guarded by a bearer CRON_SECRET, but nothing
# on the host was scheduling them, so long-lived Instagram tokens were never
# being refreshed and would have expired silently. This script is the scheduler.
#
# CRON_SECRET is read from .env at run time rather than baked into the crontab,
# so the secret never appears in `crontab -l` or in process listings.
#
# Usage: run-cron.sh <endpoint-name>
#   e.g. run-cron.sh refresh-tokens

set -euo pipefail

APP_DIR="/home/ubuntu/openreply"
ENV_FILE="$APP_DIR/.env"
BASE_URL="http://127.0.0.1:3000"
LOG_FILE="/home/ubuntu/openreply-cron.log"

endpoint="${1:?usage: run-cron.sh <endpoint-name>}"

if [ ! -r "$ENV_FILE" ]; then
  echo "$(date -Is) [$endpoint] ERROR: cannot read $ENV_FILE" >>"$LOG_FILE"
  exit 1
fi

# Pull the value without sourcing the file, which would execute it and choke on
# unquoted special characters in other entries.
secret="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"'"'"'')"

if [ -z "$secret" ]; then
  echo "$(date -Is) [$endpoint] ERROR: CRON_SECRET missing from .env" >>"$LOG_FILE"
  exit 1
fi

response="$(
  curl -sS --max-time 120 -w '\n%{http_code}' \
    -H "Authorization: Bearer $secret" \
    "$BASE_URL/api/cron/$endpoint" 2>&1 || true
)"

status="$(printf '%s' "$response" | tail -n1)"
body="$(printf '%s' "$response" | sed '$d' | head -c 500)"

echo "$(date -Is) [$endpoint] status=$status body=$body" >>"$LOG_FILE"

# Keep the log from growing without bound.
if [ "$(stat -c %s "$LOG_FILE" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 500 "$LOG_FILE" >"$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

case "$status" in
  2*) exit 0 ;;
  *) exit 1 ;;
esac
