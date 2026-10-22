// Validate a Medical Information request before it is logged. Dry runs (evaluation) log nothing.
const i = $input.first().json;
const name = String(i.requester_name || '').trim();
const contact = String(i.contact || '').trim();
const question = String(i.question || '').trim();
const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
const phone = contact.replace(/\D/g, '').length >= 10;
const missing = [];
if (name.length < 2) missing.push("the requester's name");
if (!email && !phone) missing.push('a valid email address or phone number');
if (question.length < 10) missing.push('the exact question');
if (missing.length) {
  return [{ json: { ok: false, result: { success: false, message: 'Not submitted. Ask for ' + missing.join(', ') + ', then call the tool again.' } } }];
}
if (i.dry_run === true || String(i.dry_run) === 'true') {
  return [{ json: { ok: false, result: { success: true, ref: 'MIR-DRYRUN', message: 'Dry run: nothing was submitted.' } } }];
}
const ref = 'MIR-' + $now.toFormat('yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
return [{
  json: {
    ok: true,
    payload: JSON.stringify({
      ref, session_id: i.session_id, channel: i.channel, reporter_role: i.role, product: i.product,
      requester_name: name.slice(0, 120), contact: contact.slice(0, 160), question: question.slice(0, 2000), max: 3,
    }),
  },
}];
