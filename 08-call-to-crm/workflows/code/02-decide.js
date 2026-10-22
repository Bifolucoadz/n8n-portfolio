// Decides what goes into the CRM now and what waits for the rep, with fixed rules:
// - Notes and the rep's own tasks are always added.
// - A stage moves by itself only one step forward, with medium or high confidence and a quote that is
//   really in the transcript. Closed won / lost, skips, moves backwards or unverified quotes wait.
// - Amount and close date fill empty fields by themselves; changing a set value waits (amount only if
//   it moves more than the % in Settings).
// - The follow-up email always waits for the rep.
// @include lib-tdw.js
const p = $('Prepare').first().json;
const t = $('Transcript').first().json;
const x = aiJson($input.first().json);
if (!x) throw new Error('The call analysis failed.');
const s = p.settings, crm = p.crm, deal = crm.deal;
const tn = norm(t.transcript);
const pct = Number(s.amount_change_pct || 20);
const applied = [], pending = [];
const ver = q => quoteFound(q, tn);

// Talk time per side (words), worked out in the Transcript node.
const talk = t.talk_us;
const nameOf = {};
// Stage
const rec = x.stage_recommendation || {};
const cur = stageIndex(deal.stage), nxt = stageIndex(rec.stage);
if (rec.stage && rec.stage !== deal.stage) {
  const change = { id: 'stage', field: 'stage', label: 'Deal stage', from: stageLabel(deal.stage), to: stageLabel(rec.stage), value: rec.stage, quote: rec.quote, verified: ver(rec.quote), reason: rec.reason };
  const auto = nxt === cur + 1 && !['closedwon', 'closedlost'].includes(rec.stage) && rec.confidence !== 'low' && change.verified;
  if (auto) applied.push(change);
  else pending.push({ ...change, why: ['closedwon', 'closedlost'].includes(rec.stage) ? 'Closing a deal always needs you.' : !change.verified ? 'The supporting quote couldn\'t be found in the transcript.' : rec.confidence === 'low' ? 'The AI wasn\'t confident.' : 'It skips a stage or moves backwards.' });
}
// Amount
const du = x.deal_updates || {};
if (du.amount !== null && du.amount !== undefined && Number(du.amount) > 0 && Number(du.amount) !== Number(deal.amount)) {
  const change = { id: 'amount', field: 'amount', label: 'Amount', from: deal.amount ? dollars(deal.amount) : 'not set', to: dollars(du.amount), value: Number(du.amount), quote: du.amount_quote, verified: ver(du.amount_quote) };
  const move = deal.amount ? Math.abs(du.amount - deal.amount) / deal.amount * 100 : 0;
  if (change.verified && (!deal.amount || move <= pct)) applied.push(change);
  else pending.push({ ...change, why: !change.verified ? 'The supporting quote couldn\'t be found in the transcript.' : 'Changes the amount by ' + Math.round(move) + '% (more than ' + pct + '%).' });
}
// Close date
if (du.close_date && /^\d{4}-\d{2}-\d{2}$/.test(du.close_date) && du.close_date !== deal.close_date) {
  const change = { id: 'close_date', field: 'close_date', label: 'Close date', from: deal.close_date || 'not set', to: du.close_date, value: du.close_date, quote: du.close_date_quote, verified: ver(du.close_date_quote) };
  if (change.verified && !deal.close_date) applied.push(change);
  else pending.push({ ...change, why: !change.verified ? 'The supporting quote couldn\'t be found in the transcript.' : 'Replaces the close date already set.' });
}
// Tasks for our side; their side goes in the note.
const workday = n => { let d = DateTime.fromISO(p.call_date, { zone: TZ }); let k = 0; while (k < n) { d = d.plus({ days: 1 }); if (d.weekday <= 5) k++; } return d.toISODate(); };
const ours = (x.next_steps || []).filter(n => n.side === 'us');
const theirs = (x.next_steps || []).filter(n => n.side === 'them');
const tasks = ours.map(n => ({ title: n.action, due: /^\d{4}-\d{2}-\d{2}$/.test(n.due) ? n.due : workday(Number(s.default_task_days || 2)), owner: n.owner || p.rep, quote: n.quote }));
if (tasks.length) applied.push({ id: 'next_step', field: 'next_step', label: 'Next step', from: deal.next_step || 'not set', to: tasks[0].title, value: tasks[0].title, quote: tasks[0].quote, verified: true });

const b = x.bant || {};
const line = (k, v) => k + ': ' + (v ? v.detail + ' (' + v.status + ')' : 'unknown');
const note = [
  x.summary, '',
  line('Budget', b.budget), line('Authority', b.authority), line('Need', b.need), line('Timeline', b.timeline), '',
  (x.objections || []).length ? 'Objections: ' + x.objections.map(o => o.objection + ' (' + o.status + ')').join('; ') : 'Objections: none',
  (x.competitors || []).length ? 'Competitors: ' + x.competitors.map(c => c.name + ', ' + c.context).join('; ') : 'Competitors: none mentioned',
  theirs.length ? 'Waiting on them: ' + theirs.map(n => n.action + ' (' + n.owner + (n.due ? ', ' + n.due : '') + ')').join('; ') : '',
  (x.risks || []).length ? 'Risks: ' + x.risks.join('; ') : '',
  talk !== null ? 'Talk time: rep ' + talk + '%, prospect ' + (100 - talk) + '%' : ''
].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');

const main = (crm.contacts || []).find(c => (x.speakers || []).some(sp => sp.side === 'them' && norm(sp.name) === norm(c.name))) || (crm.contacts || [])[0] || {};
const email = x.follow_up_email || { subject: '', body: '' };
pending.push({ id: 'email', field: 'email', label: 'Follow-up email to ' + (main.name || 'the prospect'), to: main.email || '', value: email.subject, verified: true, why: 'Emails to prospects always need you.' });

return [{ json: {
  call_id: p.call_id, deal_id: deal.deal_id, rep: p.rep, analysis: x, talk_us: talk, speakers: nameOf, applied, pending, tasks, note,
  email_to: main.email || '', email_subject: email.subject, email_body: email.body,
  quotes_checked: [rec.quote, du.amount_quote, du.close_date_quote].filter(Boolean).length,
  quotes_verified: [rec.quote, du.amount_quote, du.close_date_quote].filter(q => q && ver(q)).length
} }];
