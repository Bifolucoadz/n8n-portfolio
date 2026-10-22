// Checks the site visit form and gathers what the AI needs: the notes, the voice memo (if any) and up to
// three photos (as data URLs for the model). The binary files stay on the item for the transcription step.
// @include lib-mgv.js
const item = $input.first();
const f = item.json;
const bin = item.binary || {};
const str = v => String(v === null || v === undefined ? '' : v).trim();
const errors = [];
const name = str(f.client_name), email = str(f.client_email).toLowerCase(), address = str(f.site_address);
const notes = str(f.notes);
const keys = Object.keys(bin);
const voiceKey = keys.find(k => /^voice/i.test(k)) || '';
const photoKeys = keys.filter(k => /^photo/i.test(k));
if (name.length < 2) errors.push('Add the client\'s name.');
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('The client email doesn\'t look right.');
if (!address) errors.push('Add the site address.');
if (notes.length < 15 && !voiceKey) errors.push('Add notes about the job or attach a voice memo.');
if (voiceKey && Number(bin[voiceKey].fileSize || 0) > 24e6) errors.push('The voice memo is over 24 MB; record a shorter one.');
const images = [];
let skipped = 0;
for (const k of photoKeys) {
  const b = bin[k];
  if (images.length >= 3 || !/^image\/(jpeg|png|webp)$/.test(String(b.mimeType || ''))) { skipped++; continue; }
  const buf = await this.helpers.getBinaryDataBuffer(0, k);
  if (buf.length > 8e6) { skipped++; continue; }
  images.push('data:' + b.mimeType + ';base64,' + buf.toString('base64'));
}
return [{ json: {
  ok: !errors.length, errors,
  client_name: name, client_email: email, client_phone: str(f.client_phone), site_address: address,
  postcode: str(f.postcode).toUpperCase(), estimator: str(f.estimator) || 'Tom Hale', notes,
  has_voice: !!voiceKey, voice_key: voiceKey, images, photo_count: images.length, photos_skipped: skipped,
  started_ms: Date.now()
}, binary: bin }];
