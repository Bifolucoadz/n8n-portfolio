// ---- lib-ilf.js (included by build.py): shared helpers for the Ironleaf workflows ----
const TZ = 'Europe/London';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));
const parseJson = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const clip = (t, n) => { t = String(t || '').trim().replace(/\.$/, ''); return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…'; };
const nowIso = () => DateTime.now().setZone(TZ).toISO();
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && o.type === 'message');
  const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}
function emailHtml(company, paragraphs, extraHtml) {
  const p = paragraphs.filter(Boolean).map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1f26;max-width:600px;text-align:left">'
    + '<div style="font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#d9480f;margin:0 0 18px">' + esc(company) + '</div>'
    + p + (extraHtml || '') + '</div>';
}
// ---- end lib-ilf.js ----
