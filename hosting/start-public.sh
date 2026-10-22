#!/bin/bash
# Puts the n8n on this Mac on the internet at your free ngrok domain, for the phone receptionist
# (Vapi, project 5) and the WhatsApp shop (Meta + Paystack, project 6). Keeps the Mac awake until Ctrl+C.
#
# Only /webhook/... is reachable from outside (ngrok-policy.yml); the n8n editor stays private.
# n8n must run with WEBHOOK_URL set to the public address, so the WhatsApp Trigger registers the
# right URL with Meta. If n8n isn't running, this script starts it that way.
#
# Needs: brew install ngrok, `ngrok config add-authtoken <token>` once, and hosting/.env with
#   NGROK_DOMAIN=your-name.ngrok-free.app
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${NGROK_DOMAIN:?Put NGROK_DOMAIN=your-name.ngrok-free.app in hosting/.env}"
URL="https://$NGROK_DOMAIN/"
command -v ngrok >/dev/null || { echo "ngrok isn't installed: brew install ngrok"; exit 1; }

if curl -fsS -m 3 http://localhost:5678/healthz >/dev/null 2>&1; then
  PID=$(lsof -ti tcp:5678 -sTCP:LISTEN | head -1)
  if ! ps eww -o command= -p "$PID" 2>/dev/null | tr ' ' '\n' | grep -qx "WEBHOOK_URL=$URL"; then
    echo "n8n is running without WEBHOOK_URL=$URL."
    echo "Stop it (Ctrl+C in its terminal) and run this script again; it will start n8n for you."
    exit 1
  fi
  echo "n8n is already running with the public address."
else
  echo "Starting n8n with WEBHOOK_URL=$URL (log: hosting/n8n.log)..."
  WEBHOOK_URL="$URL" N8N_PROXY_HOPS=1 nohup n8n start >n8n.log 2>&1 &
  for _ in $(seq 1 60); do curl -fsS -m 2 http://localhost:5678/healthz >/dev/null 2>&1 && break; sleep 2; done
  curl -fsS -m 2 http://localhost:5678/healthz >/dev/null || { echo "n8n didn't start. See hosting/n8n.log"; exit 1; }
fi

echo "Public webhooks: ${URL}webhook/...   (Ctrl+C to go offline; n8n keeps running)"
exec caffeinate -i ngrok http 5678 --url="$NGROK_DOMAIN" --traffic-policy-file=ngrok-policy.yml --log=stdout --log-level=warn
