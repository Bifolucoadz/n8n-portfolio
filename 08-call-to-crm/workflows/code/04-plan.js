// What the rep decided: which waiting changes to apply, and whether to send the (possibly edited) email.
// The token must match and the call must still be waiting for review.
// @include lib-tdw.js
const b = $('Review Submit').first().json.body || {};
const c = $('Read Call (Submit)').all().map(i => i.json).find(r => r.call_id === b.call_id) || null;
const s = settingsOf($('Read Settings (Submit)').all());
if (!c || !b.token || b.token !== c.token) return [{ json: { ok: false, code: 403, message: 'Not allowed.' } }];
if (c.status !== 'pending_review') return [{ json: { ok: false, code: 409, message: 'This call was already reviewed.' } }];
const action = ['send', 'approve', 'discard'].includes(b.action) ? b.action : 'approve';
const pending = parseJson(c.pending_json, []);
const chosen = action === 'discard' ? [] : pending.filter(p => p.field !== 'email' && [].concat(b.approve || []).includes(p.id));
const fields = {};
for (const p of chosen) fields[p.field] = p.value;
const subject = String(b.subject || c.email_subject).slice(0, 200);
const body = String(b.body || c.email_body).slice(0, 5000);
const ops = [];
if (Object.keys(fields).length) ops.push({ action: 'update_deal', deal_id: c.deal_id, fields });
if (action === 'send') ops.push({ action: 'add_note', deal_id: c.deal_id, kind: 'email', title: 'Follow-up email sent: ' + subject, body, owner: c.rep, source: 'call-autopilot' });
const applied = parseJson(c.applied_json, { changes: [], tasks: [] });
applied.changes = applied.changes.concat(chosen.map(p => ({ ...p, approved_by: c.rep })));
const status = action === 'send' ? 'sent' : action === 'approve' ? 'approved' : 'discarded';
return [{ json: {
  ok: true, code: 200, call_id: c.call_id, status, ops,
  email: action === 'send' && c.email_to ? { to: c.email_to, subject, html: plainToHtml(body), kind: 'follow_up', call_id: c.call_id } : null,
  row: { applied_json: JSON.stringify(applied), pending_json: JSON.stringify(pending.filter(p => !chosen.includes(p))), email_subject: subject, email_body: body, status, reviewed_at: nowIso() },
  message: status === 'sent' ? 'Sent, and the CRM is up to date.' : status === 'approved' ? 'Changes approved.' : 'Discarded.'
} }];
