// Checks the upload and works out which deal the call belongs to.
// @include lib-tdw.js
const item = $input.first();
const j = item.json;
const m = String(j.deal || '').match(/\((D-\d+)\)/);
const errors = [];
if (!m) errors.push('Please choose the deal.');
const [key, file] = Object.entries(item.binary || {})[0] || [];
if (!file) errors.push('Please attach the call recording.');
else if (!/audio|video\/(mp4|webm)/i.test(file.mimeType || '') && !/\.(mp3|m4a|wav|webm|mp4|ogg)$/i.test(file.fileName || '')) errors.push('Please upload an audio file (MP3, M4A, WAV, WEBM or MP4).');
else if ((await this.helpers.getBinaryDataBuffer(0, key)).length > 25 * 1024 * 1024) errors.push('The recording is over 25 MB. Please upload a shorter or compressed file.');
return [{ json: { ok: errors.length === 0, errors, call_id: newId('CL-'), deal_id: m ? m[1] : '', rep: String(j.rep || ''), notes: String(j.notes || '').slice(0, 1000) }, binary: file ? { data: file } : {} }];
