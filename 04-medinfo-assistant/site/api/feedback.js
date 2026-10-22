// Thumbs up/down from the hosted page, forwarded to n8n (MedInfo 6: Chat API).
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST' }); }
  const base = process.env.N8N_BASE_URL;
  if (!base) return res.status(503).json({ error: 'Assistant backend is not configured' });
  const { turn_id, rating, comment } = req.body || {};
  if (typeof turn_id !== 'string' || !turn_id) return res.status(400).json({ error: 'turn_id is required' });
  try {
    const upstream = await fetch(`${base}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turn_id: turn_id.slice(0, 60), rating: Number(rating) > 0 ? 1 : -1, comment: String(comment || '').slice(0, 1000) }),
      signal: AbortSignal.timeout(15000),
    });
    res.status(upstream.status).setHeader('Content-Type', 'application/json');
    return res.send(await upstream.text());
  } catch {
    return res.status(502).json({ error: 'Assistant backend is offline' });
  }
};
