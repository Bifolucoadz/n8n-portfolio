// Returns the stored CV as a PDF, for people with the dashboard key.
// @include lib-ngt.js
const q = $('CV Request').first().json.query || {};
const s = settingsOf($('Read Settings (CV)').all());
const f = $('Read CV File').all().map(i => i.json).find(r => r.candidate_id === q.c && r.base64);
if (!s.dashboard_key || q.key !== s.dashboard_key || !f) return [{ json: { found: false } }];
const data = await this.helpers.prepareBinaryData(Buffer.from(f.base64, 'base64'), f.filename || 'cv.pdf', f.mime || 'application/pdf');
return [{ json: { found: true, filename: f.filename }, binary: { data } }];
