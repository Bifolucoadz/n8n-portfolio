// Checks the form answers and the CV, and gives the application an ID.
// The CV goes on to screening as binary "data".
// @include lib-ngt.js
const item = $input.first();
const j = item.json;
const errors = [];

const jobMatch = String(j.job || '').match(/\((NG-\d+)\)/);
const job_id = jobMatch ? jobMatch[1] : '';
if (!job_id) errors.push('Please choose the job you are applying for.');

const name = String(j.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
if (name.length < 2) errors.push('Please enter your name.');
const email = String(j.email || '').trim().toLowerCase().slice(0, 120);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address.');

const [key, cv] = Object.entries(item.binary || {})[0] || [];
let size = 0;
if (!cv) errors.push('Please attach your CV as a PDF.');
else {
  const isPdf = /pdf/i.test(cv.mimeType || '') || /\.pdf$/i.test(cv.fileName || '');
  if (!isPdf) errors.push('Please send your CV as a PDF.');
  size = (await this.helpers.getBinaryDataBuffer(0, key)).length;
  if (size > 5 * 1024 * 1024) errors.push('Your CV is over 5 MB. Please send a smaller PDF.');
}
const consent = [].concat(j.consent || []).length > 0;
if (!consent) errors.push('Please agree to us keeping your application.');

const salary = Number(String(j.salary ?? '').replace(/[^0-9.]/g, '')) || 0;
const stamp = DateTime.now().setZone(TZ);
const candidate_id = 'C' + stamp.toFormat('LLdd') + '-' + newToken(4).toUpperCase();

const json = {
  ok: errors.length === 0,
  errors,
  candidate_id,
  job_id,
  job_label: String(j.job || '').replace(/\s*\(NG-\d+\)\s*$/, ''),
  name,
  email,
  phone: String(j.phone || '').trim().slice(0, 40),
  linkedin: String(j.linkedin || '').trim().slice(0, 200),
  right_to_work: String(j.right_to_work || ''),
  notice_period: String(j.notice || ''),
  salary_expectation: salary,
  cv_filename: cv ? (cv.fileName || 'cv.pdf') : '',
  cv_bytes: size,
  applied_at: stamp.toISO()
};
return [{ json, binary: cv ? { data: cv } : {} }];
