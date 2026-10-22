// Turn the screen's findings into cases and notes for the agent. Safety routing happens here in
// code, so it does not depend on the agent choosing to do it.
const prep = $('Prepare Turn').first().json;
const ctx = $('Load Context').first().json.context ?? {};
let s = null;
for (const o of $input.first().json.output ?? []) {
  for (const c of o.content ?? []) {
    let d = c.text;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    if (d && typeof d === 'object') s = d;
  }
}
const screenFailed = !s;
s = s || {
  standalone_question: prep.message, request_type: 'other', product: 'none', speaker: 'unknown',
  adverse_event: { detected: false }, product_complaint: { detected: false }, off_label: { detected: false }, emergency: false,
};
// The role is known for staff; only the public site can be a patient or caregiver.
if (prep.role !== 'hcp') s.speaker = 'company_employee';
const product = ['quenvara', 'lumetra', 'aurivex'].includes(s.product) ? s.product : '';
const open = ctx.open_cases ?? [];
const day = $now.toFormat('yyMMdd');
const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
// A second message about the same event in the same chat adds follow-up to the open case.
const refFor = (type, prefix) => {
  const hit = open.find(c => c.case_type === type && (c.product || '') === product);
  return hit ? { ref: hit.ref, followup: true } : { ref: `${prefix}-${day}-${rand()}`, followup: false };
};
const cases = [], notes = [], caseRefs = [];

if (s.adverse_event?.detected) {
  const r = refFor('adverse_event', 'AE');
  const missing = s.adverse_event.missing_information || 'none';
  caseRefs.push(r.ref);
  cases.push({
    ref: r.ref, case_type: 'adverse_event', session_id: prep.session_id, channel: prep.channel, reporter_role: prep.role,
    product, summary: s.adverse_event.summary, details: { ...s.adverse_event, speaker: s.speaker, message: prep.message },
  });
  notes.push(r.followup
    ? `ADVERSE EVENT FOLLOW-UP: this message adds information to case ${r.ref}, which has been updated for Larkmoor Pharmacovigilance. Confirm the information was added to ${r.ref}. Ask for anything still missing: ${missing}.`
    : `ADVERSE EVENT: this message reports a possible adverse event or special situation. It has been recorded as ${r.ref} and sent to Larkmoor Pharmacovigilance (SOP-PV-001). Begin by thanking them and saying the report has been passed to Pharmacovigilance with reference ${r.ref}. Ask only for missing minimum information: ${missing}. Never ask again for anything already given in the conversation. Do not judge whether the medicine caused it and do not give treatment advice. Then answer any question they asked.`);
}
if (s.product_complaint?.detected) {
  const r = refFor('product_complaint', 'PC');
  const missing = s.product_complaint.missing_information || 'none';
  caseRefs.push(r.ref);
  cases.push({
    ref: r.ref, case_type: 'product_complaint', session_id: prep.session_id, channel: prep.channel, reporter_role: prep.role,
    product, summary: s.product_complaint.summary, details: { ...s.product_complaint, speaker: s.speaker, message: prep.message },
  });
  notes.push(r.followup
    ? `PRODUCT COMPLAINT FOLLOW-UP: this adds information to complaint ${r.ref} for Quality Assurance. Confirm it was added. Ask for anything still missing: ${missing}.`
    : `PRODUCT COMPLAINT: recorded as ${r.ref} and sent to Larkmoor Quality Assurance (SOP-QA-004). Confirm the reference, ask them to keep the product and its packaging, and ask for anything missing: ${missing}. Never ask again for anything already given in the conversation. Do not promise a replacement or refund.`);
}
if (s.off_label?.detected) {
  const topic = s.off_label.topic || 'a use outside the approved labeling';
  notes.push({
    hcp: `OFF-LABEL: the question is about ${topic}, which is outside the approved labeling. Do not provide data, experience or opinions on it. You may quote what the approved labeling itself says about it, with citations. Offer to submit a Medical Information request so the Medical Information team can answer directly.`,
    field: `OFF-LABEL: the representative is asking about ${topic}, which is outside the approved labeling. Under SOP-MI-002 they must not discuss it. Do not provide any off-label information. Say so briefly, quote what the labeling says if relevant (cited), and offer to submit a Medical Information request on the healthcare professional's behalf.`,
    medinfo: `OFF-LABEL: the question is about ${topic}. Answer from the standard response letters if they cover it, starting with the line "Off-label information: for responses to unsolicited requests only.", and include what the labeling says.`,
  }[prep.role]);
}
// Anyone can type on the public site, so an emergency there always gets the fixed reply first.
const emergencyFixed = !!s.emergency && prep.role === 'hcp';
if (s.emergency && !emergencyFixed) {
  notes.push('URGENT: the message describes a possible emergency. Start your reply with: "If this is a medical emergency, follow your emergency protocol or call 911. Poison Control: 1-800-222-1222." Then give the relevant labeling information briefly.');
}
if (s.speaker === 'patient_or_caregiver') {
  notes.push('The person seems to be a patient or caregiver. Do not give personalised medical advice or discuss off-label use. Share general labeling information only and tell them to speak to their doctor or pharmacist.');
}
if (screenFailed) {
  notes.push('The compliance screen failed for this message. If it mentions a side effect, a problem with a product or an emergency, tell the person to call Larkmoor Pharmacovigilance on 1-800-555-0177.');
}
const fixedReply = emergencyFixed
  ? 'If someone is in danger right now, call 911 or your local emergency number. For a possible overdose or poisoning, call Poison Control at 1-800-222-1222 (healthcare professionals can call them for management advice too). I can\'t give medical advice in an emergency.' +
    (caseRefs.length ? ` Your report has been passed to Larkmoor Pharmacovigilance (reference ${caseRefs.join(', ')}).` : '')
  : '';
return [{
  json: {
    screen: s,
    screen_failed: screenFailed,
    product,
    // Dry runs (evaluation) record the route but open no cases.
    cases: prep.dry_run ? [] : cases,
    case_refs: caseRefs,
    turn_notes: notes.length ? notes.map(n => '- ' + n).join('\n') : '- Nothing special detected in this message.',
    emergency_fixed: emergencyFixed,
    fixed_reply: fixedReply,
    // Retrieve before the agent starts, so most answers need one model call instead of two.
    search_first: !emergencyFixed && !!String(s.standalone_question || '').trim() && s.request_type !== 'small_talk',
    search_query: String(s.standalone_question || prep.message).slice(0, 500),
    search_product: product || 'any',
  },
}];
