// ---- lib-tdw.js (included by build.py): shared helpers for the Tidewater workflows ----
const TZ = 'America/New_York';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const settingsOf = items => Object.fromEntries(items.map(i => i.json).filter(r => r && r.key).map(r => [r.key, r.value]));
const parseJson = (s, d) => { try { return typeof s === 'string' ? JSON.parse(s) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const nowIso = () => DateTime.now().setZone(TZ).toISO();
const newId = (prefix, n) => prefix + Array.from({ length: n || 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const newToken = n => Array.from({ length: n || 24 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');
const dollars = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const day = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? DateTime.fromISO(d, { zone: TZ }).toFormat('ccc, LLL d') : String(d || '');
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// HubSpot's default sales pipeline.
const STAGES = [
  ['appointmentscheduled', 'Appointment scheduled', 'A first meeting is booked.'],
  ['qualifiedtobuy', 'Qualified to buy', 'Need, rough budget, decision process and timeline are understood.'],
  ['presentationscheduled', 'Presentation scheduled', 'A demo or presentation is booked or has been given.'],
  ['decisionmakerboughtin', 'Decision maker bought-in', 'The person who signs has seen it and supports it.'],
  ['contractsent', 'Contract sent', 'A proposal or contract has been sent.'],
  ['closedwon', 'Closed won', 'Signed.'],
  ['closedlost', 'Closed lost', 'The prospect said no.']
];
const stageIndex = id => STAGES.findIndex(s => s[0] === id);
const stageLabel = id => (STAGES.find(s => s[0] === id) || [id, id])[1];

// OpenAI node (Responses API) output: the JSON object from the first output_text part, or null.
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && o.type === 'message');
  const part = msg && (msg.content || []).find(c => c && c.type === 'output_text');
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}

// Is this quote really in the transcript? (case, punctuation and spacing ignored)
const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const quoteFound = (quote, transcriptNorm) => { const q = norm(quote); return q.length >= 6 && transcriptNorm.includes(q); };

function emailHtml(company, paragraphs, extraHtml) {
  const p = paragraphs.map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px;text-align:left">'
    + '<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;margin:0 0 18px">' + esc(company) + '</div>'
    + p + (extraHtml || '') + '</div>';
}
const plainToHtml = t => String(t || '').split(/\n{2,}/).map(p => '<p style="margin:0 0 14px;text-align:left">' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
// n8n shows a form's completion HTML as the whole page, so it needs its own styling.
function formPage(title, inner) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title>'
    + '<style>body{margin:0;background:#eef2fb;font:15px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#0f1b3d}'
    + '.card{max-width:760px;margin:40px auto;background:#fff;border:1px solid #d9e1f2;border-radius:16px;padding:30px 32px;box-shadow:0 8px 24px rgba(15,27,61,.06)}'
    + '.brand{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;margin-bottom:16px}</style></head>'
    + '<body><div class="card"><div class="brand">Tidewater Software · Call autopilot</div>' + inner + '</div></body></html>';
}
// ---- end lib-tdw.js ----
