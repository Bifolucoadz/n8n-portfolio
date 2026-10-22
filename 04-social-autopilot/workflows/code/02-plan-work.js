// One pass over the calendar: give rows an ID and a slot, start drafts and publishing that are due,
// remind the owner about drafts still waiting at post time, and un-stick rows that stopped half-way.
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const rows = $('Read Calendar').all().map(i => i.json);
const tz = S.timezone || 'Africa/Lagos';
const now = DateTime.now().setZone(tz);
const nowText = now.toFormat('yyyy-MM-dd HH:mm');
const leadHours = Number(S.draft_hours_ahead) > 0 ? Number(S.draft_hours_ahead) : 48;
const approver = state.approver_chat_id || '';
const MAX_DRAFTS = 3;
const MAX_PUBLISH = 2;

function parseWhen(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return DateTime.fromMillis(Math.round((v - 25569) * 86400000), { zone: 'UTC' }).setZone(tz, { keepLocalTime: true });
  const s = String(v).trim().replace('T', ' ');
  for (const f of ['yyyy-MM-dd HH:mm', 'yyyy-MM-dd H:mm', 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd']) {
    const d = DateTime.fromFormat(s, f, { zone: tz });
    if (d.isValid) return d;
  }
  return null;
}
const key = d => d.toFormat('yyyy-MM-dd HH:mm');

// Posting slots from Settings: post_days (Mon, Wed, Fri) at post_time (09:00).
const dayNum = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
let days = String(S.post_days || 'Mon, Wed, Fri').toLowerCase().split(/[\s,;]+/).map(d => dayNum[d.slice(0, 3)]).filter(Boolean);
if (!days.length) days = [1, 3, 5];
const [hh, mm] = (String(S.post_time || '09:00').match(/^(\d{1,2}):(\d{2})/) || [0, '9', '00']).slice(1).map(Number);

const taken = new Set();
for (const r of rows) {
  const w = parseWhen(r.publish_at);
  if (w && String(r.status || '').trim() !== 'rejected') taken.add(key(w));
}
function nextSlot() {
  const start = now.startOf('day');
  for (let i = 0; i < 180; i++) {
    const c = start.plus({ days: i }).set({ hour: hh, minute: mm });
    if (days.includes(c.weekday) && c > now.plus({ hours: 1 }) && !taken.has(key(c))) { taken.add(key(c)); return c; }
  }
  return null;
}

const usedIds = new Set(rows.map(r => String(r.post_id || '').trim()).filter(Boolean));
function newId() {
  let id;
  do { id = 'P-' + Math.random().toString(36).slice(2, 7).toUpperCase(); } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

const work = [];
const updates = [];
let drafts = 0;
let publishes = 0;
for (const r of rows) {
  if (!String(r.topic || '').trim()) continue;
  const u = { row_number: r.row_number };
  let id = String(r.post_id || '').trim();
  if (!id) { id = newId(); u.post_id = id; }
  let st = String(r.status || '').trim().toLowerCase();
  if (!st) { st = 'idea'; u.status = 'idea'; }
  let when = parseWhen(r.publish_at);
  const badDate = String(r.publish_at ?? '').trim() !== '' && !when;
  const touched = parseWhen(r.updated_at);
  const ageMin = touched ? now.diff(touched, 'minutes').minutes : 9999;

  if (st === 'idea') {
    if (badDate) {
      Object.assign(u, { status: 'needs_fix', error: 'publish_at must look like 2026-10-12 09:00 (24-hour, ' + tz + '). Fix it, then set status back to idea.', updated_at: nowText });
    } else {
      if (!when) { when = nextSlot(); if (when) u.publish_at = key(when); }
      if (when && when.diff(now, 'hours').hours <= leadHours && drafts < MAX_DRAFTS) {
        Object.assign(u, { status: 'drafting', error: '', updated_at: nowText });
        work.push({ json: { kind: 'draft', post_id: id } });
        drafts++;
      }
    }
  } else if (st === 'drafting' && ageMin > 20) {
    const attempts = (Number(r.attempts) || 0) + 1;
    Object.assign(u, { attempts: String(attempts), updated_at: nowText });
    if (attempts >= 3) Object.assign(u, { status: 'needs_fix', error: 'Drafting stopped 3 times without finishing. Check the Social Autopilot 5 executions in n8n.' });
    else Object.assign(u, { status: 'idea', error: 'Drafting stopped half-way; trying again.' });
  } else if (st === 'approved' && (!when || when <= now) && publishes < MAX_PUBLISH) {
    Object.assign(u, { status: 'publishing', updated_at: nowText });
    if (!when) u.publish_at = nowText;
    work.push({ json: { kind: 'publish', post_id: id } });
    publishes++;
  } else if (st === 'publishing' && ageMin > 30) {
    Object.assign(u, { status: 'failed', updated_at: nowText, error: 'Publishing stopped half-way. Platforms that already have a link were posted; set status to approved to post the rest.' });
    if (approver) work.push({ json: { kind: 'remind', chat: approver, reply_to: 0, text: '⚠️ Publishing <code>' + id + '</code> stopped half-way. Check the links in the sheet, then set its status to approved to post the rest.' } });
  } else if (st === 'in_review' && when && when <= now && !String(r.reminded_at || '').trim() && approver) {
    u.reminded_at = nowText;
    work.push({ json: { kind: 'remind', chat: approver, reply_to: Number(r.preview_message_id) || 0, text: '⏰ <code>' + id + '</code> was due ' + when.toFormat('ccc d LLL, HH:mm') + ' and is still waiting for you. Approve it and it goes out within 5 minutes.' } });
  }
  if (Object.keys(u).length > 1) updates.push({ json: { kind: 'update', ...u } });
}
// Row updates first, so the sub-workflows started after them see the new status.
return [...updates, ...work];
