// Works out the score and band from the AI's ratings with fixed rules, and adds flags for the recruiter.
// Must-haves are worth 3 points and nice-to-haves 1; met earns full points, partial half.
// Knockouts come from the form answers, never from the AI. Nobody is rejected here: the band only
// orders the recruiter's list.
// @include lib-ngt.js
const prep = $('Prepare').first().json;
const anon = $('Anonymise').first().json;
const sc = anon.can_score ? aiJson($input.first().json) : null;
const s = prep.settings;
const job = prep.job || {};
const flags = [...anon.flags];
if (anon.can_score && !sc) flags.push({ level: 'warn', code: 'score_failed', text: 'The AI assessment failed, so there is no score. Please review the CV yourself.' });

const all = [
  ...prep.rubric.must.map(c => ({ ...c, type: 'must', weight: 3 })),
  ...prep.rubric.nice.map(c => ({ ...c, type: 'nice', weight: 1 }))
];
const byId = new Map(((sc && sc.criteria) || []).map(c => [c.id, c]));
let earned = 0, max = 0;
const criteria = all.map(c => {
  const r = byId.get(c.id) || { rating: 'unclear', evidence: '', reason: 'Not assessed.' };
  const pts = r.rating === 'met' ? 1 : r.rating === 'partial' ? 0.5 : 0;
  earned += pts * c.weight;
  max += c.weight;
  return { id: c.id, type: c.type, text: c.text, rating: r.rating, evidence: r.evidence, reason: r.reason };
});
const score = sc ? Math.round(100 * earned / max) : null;
const mustGaps = criteria.filter(c => c.type === 'must' && (c.rating === 'not_met' || c.rating === 'unclear')).length;

const needsSponsor = /^no/i.test(prep.right_to_work);
const knockout = needsSponsor && !job.sponsorship;
if (knockout) flags.unshift({ level: 'stop', code: 'sponsorship', text: 'Needs visa sponsorship, and this role can\'t sponsor.' });
if (prep.salary_expectation && job.salary_max && prep.salary_expectation > job.salary_max * 1.1) {
  flags.push({ level: 'warn', code: 'salary', text: 'Asking ' + pounds(prep.salary_expectation) + '; the range tops out at ' + pounds(job.salary_max) + '.' });
}
if (/3 months/.test(prep.notice_period)) flags.push({ level: 'info', code: 'notice', text: 'Notice period of 3 months or more.' });
const injected = flags.some(f => f.code === 'embedded_instructions');

const shortlistAt = Number(s.shortlist_score || 70), reviewAt = Number(s.review_score || 50);
let band;
if (knockout) band = 'knockout';
else if (score === null) band = 'review';
else if (score >= shortlistAt && mustGaps === 0 && !injected) band = 'shortlist';
else if (score >= reviewAt || injected) band = 'review';
else band = 'unlikely';

const screening = sc ? { criteria, strengths: sc.strengths || [], gaps: sc.gaps || [], interview_questions: sc.interview_questions || [] } : { criteria, strengths: [], gaps: [], interview_questions: [] };
const now = nowIso();
const row = {
  candidate_id: prep.candidate_id,
  job_id: prep.job_id,
  job_title: job.title || prep.job_label,
  name: prep.name,
  email: prep.email,
  phone: prep.phone,
  linkedin: prep.linkedin,
  right_to_work: prep.right_to_work,
  notice_period: prep.notice_period,
  salary_expectation: prep.salary_expectation,
  cv_filename: prep.cv_filename,
  profile_json: JSON.stringify(anon.profile),
  screening_json: JSON.stringify(screening),
  score: score === null ? -1 : score,
  band,
  flags_json: JSON.stringify(flags),
  status: 'new',
  summary: (sc && sc.summary) || '',
  token: newToken(24),
  slots_json: '[]',
  interview_at: '',
  applied_at: prep.applied_at,
  screened_at: now,
  updated_at: now,
  screen_ms: Date.now() - prep.started_ms
};
return [{ json: row }];
