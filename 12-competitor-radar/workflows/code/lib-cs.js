// ---- lib-cs.js (included by build.py): shared helpers for the Competitor Radar workflows ----
const TZ = 'Europe/London';
const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parseJson = (s, d) => { try { return typeof s === 'string' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const nowDt = () => DateTime.now().setZone(TZ);
const toDt = iso => DateTime.fromISO(String(iso), { zone: TZ });
const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
const nowIso = () => isoOf(nowDt());
const newId = (p, n) => p + Array.from({ length: n || 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const newToken = n => Array.from({ length: n || 24 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');
const gbp = n => n === null || n === undefined || n === '' ? '' : '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const day = iso => iso ? toDt(iso).toFormat('d LLL yyyy') : '';
const truthy = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());
const COLUMNS = __TABLES__;
// Product names compared without case, punctuation or the competitor's own name
const normName = (name, competitor) => String(name || '').toLowerCase().replace(String(competitor || '').toLowerCase(), '').replace(/[^a-z0-9]+/g, ' ').trim();

function tablesOf(res) {
  const out = {};
  for (const vr of (res && res.valueRanges) || []) {
    const name = String(vr.range || '').split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
    const rows = vr.values || [];
    const head = (rows[0] || []).map(h => String(h).trim());
    out[name] = rows.slice(1).map((r, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? '' : r[j]; });
      return o;
    }).filter(o => Object.keys(o).some(k => k !== '_row' && o[k] !== ''));
  }
  return out;
}
const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? '' : r.value]));
function sheetRow(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (k !== '_row') r[k] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  return r;
}
// OpenAI result (Responses API or the OpenAI node's simplified output) → the JSON object, or null
function aiJson(res) {
  if (!res || res.error) return null;
  const msg = (res.output || []).find(o => o && Array.isArray(o.content));
  const part = msg && (msg.content || []).find(c => c && (c.type === 'output_text' || c.text !== undefined));
  let t = part ? part.text : null;
  if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } }
  return t && typeof t === 'object' ? t : null;
}

const baseUrl = s => String(s.base_url || 'http://localhost:5678').replace(/\/$/, '');
const dashboardUrl = s => baseUrl(s) + '/webhook/radar/dashboard?key=' + encodeURIComponent(s.dashboard_key || '');
function button(url, label) {
  return '<p style="margin:22px 0;text-align:left"><a href="' + esc(url) + '" style="display:inline-block;background:#e4572e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">' + esc(label) + '</a></p>';
}
function emailHtml(s, paragraphs, extraHtml) {
  const p = paragraphs.filter(Boolean).map(t => '<p style="margin:0 0 14px;text-align:left">' + t + '</p>').join('');
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c2430;max-width:620px;text-align:left">'
    + '<div style="font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#e4572e;margin:0 0 18px">' + esc(s.company || 'Cobble & Spoke') + ' · Competitor Radar</div>'
    + p + (extraHtml || '') + '</div>';
}
function pageHtml(title, bodyHtml) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(title) + '</title>'
    + '<style>body{margin:0;background:#f3f4f6;font:16px/1.55 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1c2430}.card{max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:30px;box-shadow:0 8px 28px rgba(0,0,0,.06)}h1{font-size:22px;margin:0 0 10px}</style></head><body><div class="card"><h1>' + esc(title) + '</h1>' + bodyHtml + '</div></body></html>';
}
function emptyPlan(s) { return { mode: s.mode === 'live' ? 'live' : 'test', appends: { Changes: [], Prices: [], Runs: [], Matches: [], Watchlist: [] }, updates: { Watchlist: [], Changes: [] }, emails: [], result: { ok: true } }; }
const emailItem = (to, subject, html, kind, links) => ({ to, subject, html, kind, links: (links || []).join(' ') });

// Latest price of every product a rival still sells: rows from each page's most recent snapshot only
// (a bike dropped from the page disappears instead of keeping its old price)
function currentPrices(rows) {
  const lastCheck = {};
  for (const p of rows || []) if (!lastCheck[p.page_id] || String(p.checked_at) > lastCheck[p.page_id]) lastCheck[p.page_id] = String(p.checked_at);
  const out = {};
  for (const p of rows || []) if (String(p.checked_at) === lastCheck[p.page_id]) out[p.competitor + '|' + p.product] = p;
  return out;
}

const KIND_LABEL = { price_drop: 'Price cut', price_rise: 'Price rise', new_product: 'New product', removed_product: 'Product gone', out_of_stock: 'Out of stock', back_in_stock: 'Back in stock', promotion: 'Promotion', hiring: 'Hiring', news: 'News', messaging: 'Messaging', layout_warning: 'Check page', fetch_failed: 'Page down', other: 'Change' };
// ---- end lib-cs.js ----
