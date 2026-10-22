// The plain transcript and who could be speaking, for the speaker split.
// @include lib-tdw.js
const p = $('Prepare').first().json;
const text = String(($input.first().json || {}).text || '').trim();
if (!text) throw new Error('The recording could not be transcribed.');
const people = ['- ' + p.rep + ' (rep, Tidewater Software)'].concat((p.crm.contacts || []).map(c => '- ' + c.name + ' (' + c.title + ', ' + ((p.crm.company || {}).name || 'the prospect') + ')'));
return [{ json: { text, prompt: 'People who may be on the call:\n' + people.join('\n') + '\n\nTranscript:\n' + text } }];
