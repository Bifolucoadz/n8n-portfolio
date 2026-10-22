#!/bin/bash
# Puts the hosted chat (https://copperline-auto-repair.vercel.app/chat.html) online:
#   1. opens a Cloudflare quick tunnel to n8n on this Mac (http://localhost:5678),
#   2. points the Vercel chat proxy at it (env var N8N_CHAT_URL) and redeploys,
#   3. keeps the Mac awake and the tunnel open until you press Ctrl+C.
# The quick-tunnel address changes every time, which is why steps 2 and 3 run on each start.
# Needs: n8n running, cloudflared (brew install cloudflared), VERCEL_TOKEN in ../.env.
set -euo pipefail
cd "$(dirname "$0")/.."

WEBHOOK_PATH="/webhook/1bd58ed4-607a-469c-b6e7-60d9691a4aef/chat"
SCOPE="samuel-8951s-projects"
LOG="hosting/tunnel.log"

set -a; . ./.env; set +a
# Vercel commands run inside site/, where the project is linked. Output is shown only if a step fails.
vercel() {
  local out
  if ! out=$(cd site && npx --yes vercel@latest --token "$VERCEL_TOKEN" --scope "$SCOPE" "$@" 2>&1); then
    echo "Vercel step failed: vercel $1 $2" >&2
    printf '%s\n' "$out" | sed "s/$VERCEL_TOKEN/<token>/g" | tail -15 >&2
    return 1
  fi
}

curl -fsS -m 5 http://localhost:5678/healthz >/dev/null || { echo "n8n isn't running on localhost:5678. Start it with: n8n start"; exit 1; }

# -i keeps the Mac from idle-sleeping while the tunnel is open (a sleeping Mac drops the chat).
caffeinate -i cloudflared tunnel --no-autoupdate --url http://localhost:5678 >"$LOG" 2>&1 &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID 2>/dev/null; echo "Tunnel closed. The hosted chat is offline."' EXIT

URL=""
for _ in $(seq 1 40); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "No tunnel address after 40 s. See $LOG"; exit 1; }
echo "Tunnel: $URL"

# Wait until the tunnel reaches n8n. Resolve through Cloudflare's DNS: a brand-new hostname can sit
# in this Mac's DNS cache as "not found" for minutes, even though the rest of the internet sees it.
for _ in $(seq 1 30); do
  curl -fsS -m 5 --doh-url https://cloudflare-dns.com/dns-query "$URL/healthz" >/dev/null 2>&1 && break
  sleep 2
done

echo "Pointing Vercel at the tunnel and redeploying..."
vercel env add N8N_CHAT_URL production --value "$URL$WEBHOOK_PATH" --force --yes
vercel deploy --prod --yes

echo "Live: https://copperline-auto-repair.vercel.app/chat.html (Ctrl+C to take it offline)"
wait $TUNNEL_PID
