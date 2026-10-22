// Same-origin proxy from the chat page to the n8n Chat Trigger.
// The n8n address (a Cloudflare tunnel to the Mac running n8n) lives in one Vercel env var, N8N_CHAT_URL,
// so the page never changes when the tunnel does. Only chat messages are forwarded, to that one URL.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  const target = process.env.N8N_CHAT_URL;
  if (!target) return res.status(503).json({ error: 'Chat backend is not configured' });

  const { sessionId, chatInput } = req.body || {};
  if (typeof sessionId !== 'string' || !sessionId || typeof chatInput !== 'string' || !chatInput.trim()) {
    return res.status(400).json({ error: 'sessionId and chatInput are required' });
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId: sessionId.slice(0, 100), chatInput: chatInput.slice(0, 1000) }),
      signal: AbortSignal.timeout(55000)
    });
    // Tunnel up but n8n down (or tunnel gone) comes back as a Cloudflare error page: report it as offline.
    if (upstream.status >= 500) return res.status(502).json({ error: 'Chat backend is offline' });
    res.status(upstream.status).setHeader('Content-Type', 'application/json');
    return res.send(await upstream.text());
  } catch {
    return res.status(502).json({ error: 'Chat backend is offline' });
  }
};
