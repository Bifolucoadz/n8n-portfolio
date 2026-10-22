// Puts together what screening needs: settings, the job and its criteria, and whether this person
// already applied for this job. The CV is re-attached from the trigger item for the AI step.
// @include lib-ngt.js
const app = $('Keep CV').first();
const a = app.json;
const settings = settingsOf($('Read Settings').all());
const job = $('Read Jobs').all().map(i => i.json).find(r => r.job_id === a.job_id) || null;
const earlier = $('Earlier Applications').all().map(i => i.json)
  .filter(r => r.candidate_id && r.email === a.email && r.job_id === a.job_id && r.candidate_id !== a.candidate_id);
const rubric = job ? parseJson(job.rubric_json, { must: [], nice: [] }) : { must: [], nice: [] };
const criteriaText = 'Must-have:\n' + rubric.must.map(c => '- ' + c.id + ': ' + c.text).join('\n')
  + '\nNice to have:\n' + rubric.nice.map(c => '- ' + c.id + ': ' + c.text).join('\n');
const { cv_base64, ...rest } = a;
return [{
  json: {
    ...rest,
    job,
    rubric,
    criteria_text: criteriaText,
    settings,
    duplicate_of: earlier.length ? earlier[0].candidate_id : '',
    started_ms: Date.now(),
    today: DateTime.now().setZone(TZ).toFormat('d LLLL yyyy')
  },
  binary: { data: app.binary.data }
}];
