// Copies the CV into this run. The form's own run finishes straight away and its files go with it,
// so the AI step reads this copy. A base64 copy is kept for the recruiter dashboard.
const item = $input.first();
const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
const meta = item.binary.data;
const data = await this.helpers.prepareBinaryData(buf, meta.fileName || 'cv.pdf', meta.mimeType || 'application/pdf');
return [{ json: { ...item.json, cv_base64: buf.toString('base64'), cv_mime: meta.mimeType || 'application/pdf' }, binary: { data } }];
