#!/usr/bin/env bash
# Run EverGuide's demo automation locally: n8n plus a test inbox (MailDev).
#
#   automation/n8n/n8n.sh inbox   # test inbox: SMTP on 1025, web page on http://localhost:1080
#   automation/n8n/n8n.sh setup   # once: import the SMTP credential and the workflow
#   automation/n8n/n8n.sh start   # n8n on http://localhost:5678
#
# The shared secret is read from N8N_WEBHOOK_SECRET in the repository's .env, so
# EverGuide and n8n always agree on it. It is never printed.
set -euo pipefail

N8N_VERSION=2.35.7 # the newest n8n that runs on Node 22 (newer ones need Node 24)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

secret="$(grep -E '^N8N_WEBHOOK_SECRET=' "$ROOT/.env" | head -1 | cut -d= -f2- || true)"
if [ ${#secret} -lt 32 ]; then
  echo "Set N8N_WEBHOOK_SECRET in .env first (32+ characters; try: openssl rand -hex 32)." >&2
  exit 1
fi

export N8N_USER_FOLDER="$HERE/.n8n-data" # n8n's own database; git-ignored
export N8N_PORT=5678
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_PERSONALIZATION_ENABLED=false
export NODE_FUNCTION_ALLOW_BUILTIN=crypto  # the Code node checks signatures with crypto
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false  # ...using the secret from its environment
export EVERGUIDE_WEBHOOK_SECRET="$secret"
n8n() { npx --yes "n8n@$N8N_VERSION" "$@"; }

case "${1:-}" in
  inbox)
    exec npx --yes maildev@2 --smtp 1025 --web 1080 --ip 127.0.0.1
    ;;
  setup)
    credential="$(mktemp)"
    trap 'rm -f "$credential"' EXIT
    cat > "$credential" <<'JSON'
[{"id":"everguide-test-inbox","name":"EverGuide test inbox","type":"smtp",
  "data":{"user":"","password":"","host":"127.0.0.1","port":1025,"secure":false,"disableStartTls":true}}]
JSON
    n8n import:credentials --input="$credential"
    n8n import:workflow --input="$HERE/workflows/everguide-events.json"
    n8n publish:workflow --id=EverGuideEvents1
    echo "Done. Now run: automation/n8n/n8n.sh start"
    ;;
  start)
    exec npx --yes "n8n@$N8N_VERSION" start
    ;;
  *)
    sed -n '2,9p' "$0"
    exit 1
    ;;
esac
