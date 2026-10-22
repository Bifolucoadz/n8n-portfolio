// Same-origin proxy from the hosted page to n8n (MedInfo 6: Chat API). The n8n address (a tunnel to
// the machine running n8n) lives in one Vercel env var, N8N_BASE_URL, e.g. https://x.trycloudflare.com/webhook/medinfo
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST' }); }
  const base = process.env.N8N_BASE_URL;
  if (!base) return res.status(503).json({ error: 'Assistant backend is not configured' });
  const { session_id, message, role } = req.body || {};
  if (typeof session_id !== 'string' || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'session_id and message are required' });
  }
  try {
    const upstream = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session_id.slice(0, 80), message: message.slice(0, 2000), role: String(role || 'hcp').slice(0, 20) }),
      signal: AbortSignal.timeout(85000),
    });
    if (upstream.status >= 500) return res.status(502).json({ error: 'Assistant backend is offline' });
    res.status(upstream.status).setHeader('Content-Type', 'application/json');
    return res.send(await upstream.text());
  } catch {
    return res.status(502).json({ error: 'Assistant backend is offline' });
  }
};
