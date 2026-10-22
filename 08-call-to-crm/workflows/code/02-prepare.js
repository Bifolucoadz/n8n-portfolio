// The deal as it is in the CRM, plus the recording, ready for transcription.
// @include lib-tdw.js
const a = $('Keep Audio').first();
const crm = $('Get Deal').first().json || {};
const s = settingsOf($('Read Settings').all());
if (!crm.found) throw new Error('Deal ' + a.json.deal_id + ' was not found in the CRM.');
// Words the transcriber should spell right: names from the CRM plus the team's own vocabulary.
const vocab = [s.rep_name, (crm.company || {}).name, ...(crm.contacts || []).map(c => c.name), s.vocabulary].filter(Boolean).join(', ');
return [{ json: { ...a.json, crm, settings: s, call_date: DateTime.now().setZone(TZ).toISODate(), vocab: 'A sales call. Names and terms: ' + vocab + '.' }, binary: { data: a.binary.data } }];
