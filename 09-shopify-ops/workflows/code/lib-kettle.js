// ---- lib-kettle.js (included by build.py): shared helpers for the Kettle & Fern workflows ----
const TZ = 'America/Los_Angeles';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));
const parseJson = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const nowIso = () => DateTime.now().setZone(TZ).toISO();
const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const usd = n => '$' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(/\.00$/, '');
const clip = (t, n) => { t = String(t || '').trim().replace(/\.$/, ''); return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…'; };
const day = iso => iso ? DateTime.fromISO(String(iso), { zone: TZ }).toFormat('ccc d LLL') : '';

// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && o.type === 'message');
  const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}

// Store-branded email: a header with the shop name, paragraphs, optional extra HTML (buttons, tables).
function emailHtml(store, paragraphs, extraHtml) {
  const p = paragraphs.filter(Boolean).map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.6;color:#2b2a26;max-width:560px;text-align:left">'
    + '<div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#3f6b4a;margin:0 0 20px">' + esc(store) + '</div>'
    + p + (extraHtml || '') + '</div>';
}
// Plain text (blank lines between paragraphs) as escaped paragraphs for emailHtml.
const paragraphsOf = t => String(t || '').split(/\n{2,}/).map(p => esc(p).replace(/\n/g, '<br>'));
const button = (href, label) => '<p style="margin:6px 0 18px;text-align:left"><a href="' + esc(href) + '" style="display:inline-block;background:#3f6b4a;color:#fff;font-family:Helvetica,Arial,sans-serif;font-weight:600;padding:12px 22px;border-radius:999px;text-decoration:none">' + esc(label) + '</a></p>';
// ---- end lib-kettle.js ----
