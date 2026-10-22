// One Telegram alert per new case or follow-up, plus new Medical Information requests.
// No SAFETY_CHAT_ID configured: the cases are still recorded, just not alerted.
const call = $('When Called').first().json;
const chat = String(call.safety_chat_id || '').trim();
if (!chat) return [];
const p = JSON.parse(call.payload);
const result = $input.first().json.result ?? {};
const info = Object.fromEntries((p.cases ?? []).map(c => [c.ref, c]));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const label = { adverse_event: 'Adverse event', product_complaint: 'Product complaint' };
const alerts = [];
for (const c of result.cases ?? []) {
  const i = info[c.ref] ?? {};
  const d = i.details ?? {};
  const lines = [
    `<b>${c.new ? 'New' : 'Follow-up'}: ${label[c.case_type] ?? c.case_type} ${esc(c.ref)}</b>`,
    `Product: ${esc(i.product || 'not stated')}`,
    `Report: ${esc(i.summary)}`,
  ];
  if (c.case_type === 'adverse_event') {
    lines.push(`Seriousness: ${esc(d.seriousness)} | Special situation: ${esc(d.special_situation)}`);
    lines.push(`Missing: ${esc(d.missing_information)}`);
    lines.push('Forward to Pharmacovigilance within 24 hours (SOP-PV-001).');
  } else {
    lines.push(`Lot: ${esc(d.lot_number || 'not given')} | Missing: ${esc(d.missing_information)}`);
    lines.push('Forward to Quality Assurance within 1 business day (SOP-QA-004).');
  }
  lines.push(`From: ${esc(i.reporter_role)} via ${esc(i.channel)} | Session ${esc(i.session_id)}`);
  alerts.push(lines.join('\n'));
}
for (const ref of p.mi_refs ?? []) {
  alerts.push(`<b>New Medical Information request ${esc(ref)}</b>\nFrom: ${esc(p.turn?.role)} via ${esc(p.turn?.channel)}\nQuestion: ${esc(p.turn?.standalone_question)}\nReply due within 2 business days (SOP-MI-002).`);
}
return alerts.map(text => ({ json: { chat_id: chat, text } }));
