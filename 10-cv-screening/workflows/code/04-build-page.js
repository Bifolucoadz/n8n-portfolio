// Builds the dashboard: every job, every candidate with their screening, and a short history.
// The page needs the dashboard key from Settings; anyone without it gets a plain "not found".
// @include lib-ngt.js
const q = $('Dashboard Request').first().json.query || {};
const s = settingsOf($('Read Settings').all());
if (!s.dashboard_key || q.key !== s.dashboard_key) return [{ json: { code: 404, html: '<h1>Not found</h1>' } }];
const TEMPLATE =
__HTML_DASHBOARD__
;
const jobs = $('Read Jobs').all().map(i => i.json).filter(j => j.job_id).map(j => ({
  job_id: j.job_id, title: j.title, client: j.client, location: j.location, work_mode: j.work_mode,
  salary_min: j.salary_min, salary_max: j.salary_max, sponsorship: j.sponsorship, interviewer: j.interviewer
}));
const candidates = $('Read Candidates').all().map(i => i.json).filter(c => c.candidate_id).map(c => ({
  candidate_id: c.candidate_id, job_id: c.job_id, name: c.name, email: c.email, score: c.score, band: c.band, status: c.status,
  summary: c.summary, right_to_work: c.right_to_work, notice_period: c.notice_period, salary_expectation: c.salary_expectation,
  applied_at: c.applied_at, interview_at: c.interview_at,
  flags: parseJson(c.flags_json, []), screening: parseJson(c.screening_json, {}), slots: parseJson(c.slots_json, [])
}));
const events = {};
for (const e of $('Read Events').all().map(i => i.json).filter(e => e.candidate_id)) {
  (events[e.candidate_id] = events[e.candidate_id] || []).push({ at: e.at, text: e.detail });
}
const data = {
  company: s.company, key: q.key, mode: s.mode,
  job: jobs.some(j => j.job_id === q.job) ? q.job : (jobs[0] || {}).job_id, selected: q.c || '',
  jobs, candidates, events, generated_at: nowIso()
};
const html = TEMPLATE.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
return [{ json: { code: 200, html } }];
