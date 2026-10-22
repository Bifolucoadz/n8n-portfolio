// Turns the CV transcription into a blind profile for scoring. Names, contact details, schools,
// places and dates are removed; role titles, organisations, months, highlights, skills and
// qualifications stay. The scorer never sees who the candidate is.
// @include lib-ngt.js
const prep = $('Prepare').first().json;
const cv = aiJson($input.first().json);
const flags = [];
if (!cv) flags.push({ level: 'warn', code: 'read_failed', text: 'The CV couldn\'t be read automatically. Please open it yourself.' });

const contact = (cv && cv.contact) || {};
const secrets = [prep.name, contact.name, prep.email, contact.email, prep.phone, contact.phone, contact.location]
  .flatMap(s => String(s || '').split(/[\s,]+/))
  .map(s => s.trim()).filter(s => s.length >= 3);
const reSafe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scrub = text => {
  let t = String(text || '');
  for (const s of secrets) t = t.replace(new RegExp('\\b' + reSafe(s) + '\\b', 'gi'), '[removed]');
  return t.replace(/\b(19|20)\d{2}\b/g, '[year]').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]').replace(/\+?\d[\d ]{8,}\d/g, '[phone]');
};

let profile = null;
if (cv) {
  if (!cv.is_cv) flags.push({ level: 'warn', code: 'not_cv', text: 'The file doesn\'t look like a CV.' });
  if (cv.unreadable) flags.push({ level: 'warn', code: 'unreadable', text: 'Parts of the CV couldn\'t be read.' });
  if (cv.document_flags && cv.document_flags.embedded_instructions) {
    flags.push({ level: 'warn', code: 'embedded_instructions', text: 'The CV contains text aimed at the screening AI ("' + String(cv.document_flags.embedded_instructions_text || '').slice(0, 140) + '"). It was ignored, and this candidate can\'t be shortlisted automatically. Please read the CV yourself.' });
  }
  profile = {
    headline: scrub(cv.headline),
    total_years_experience: cv.total_years_experience,
    roles: (cv.roles || []).map(r => ({ title: scrub(r.title), organisation: scrub(r.organisation), months: r.months, highlights: (r.highlights || []).map(scrub) })),
    skills: (cv.skills || []).map(scrub),
    qualifications: (cv.education || []).map(e => scrub(e.qualification)),
    certifications: (cv.certifications || []).map(scrub),
    languages: (cv.languages || []).map(scrub)
  };
}

const job = prep.job || {};
const prompt = 'Job: ' + job.title + ' (' + job.client + '; ' + job.location + '; ' + job.work_mode + ')\n'
  + 'About the role: ' + job.summary + '\n\n' + prep.criteria_text + '\n\n'
  + 'Candidate profile (anonymised JSON):\n' + JSON.stringify(profile, null, 1);

return [{ json: { cv, profile, flags, prompt, can_score: !!(profile && cv && cv.is_cv) } }];
