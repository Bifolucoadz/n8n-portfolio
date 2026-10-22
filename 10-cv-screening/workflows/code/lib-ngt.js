// ---- lib-ngt.js (included by build.py): shared helpers for the Northgate workflows ----
const TZ = 'Europe/London';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));
const parseJson = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const nowIso = () => DateTime.now().setZone(TZ).toISO();
const newToken = n => Array.from({ length: n || 24 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');
const pounds = n => '£' + Math.round(Number(n) || 0).toLocaleString('en-GB');
const whenText = iso => DateTime.fromISO(String(iso), { zone: TZ }).toFormat("cccc d LLLL 'at' h:mm a").replace(':00 ', ' ');
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'there';

// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && o.type === 'message');
  const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}

// Plain, left-aligned email body with the agency's name at the top.
function emailHtml(company, paragraphs, extraHtml) {
  const p = paragraphs.map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">'
    + '<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#0b6e4f;margin:0 0 18px">' + esc(company) + '</div>'
    + p + (extraHtml || '') + '</div>';
}

// A small standalone web page for candidates (booking links, confirmations, problems).
function pageHtml(company, title, bodyHtml) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + ' · ' + esc(company) + '</title>'
    + '<style>body{margin:0;background:#eef3f0;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#10231a}'
    + '.card{max-width:520px;margin:48px auto;background:#fff;border:1px solid #dbe5df;border-radius:16px;padding:32px 30px;box-shadow:0 6px 24px rgba(16,35,26,.06)}'
    + '.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0b6e4f;margin-bottom:18px}'
    + 'h1{font-size:23px;margin:0 0 10px;letter-spacing:-.3px}p{color:#3d4f45;margin:0 0 12px}'
    + '.slot{display:block;padding:12px 16px;border:1px solid #dbe5df;border-radius:12px;margin:8px 0;color:#0b6e4f;font-weight:600;text-decoration:none}.slot:hover{border-color:#0b6e4f;background:#f3faf6}'
    + '.big{font-size:19px;font-weight:700;color:#10231a;margin:6px 0 14px}.muted{color:#6b7c72;font-size:13px}</style></head><body><div class="card">'
    + '<div class="brand">' + esc(company) + '</div><h1>' + esc(title) + '</h1>' + bodyHtml + '</div></body></html>';
}

const BAND_LABEL = { shortlist: 'Shortlist', review: 'Worth a look', unlikely: 'Unlikely fit', knockout: 'Knockout' };
// ---- end lib-ngt.js ----
