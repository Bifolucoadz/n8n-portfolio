// The same email already applied for this job: log it for the recruiter and stop (no second screening).
// @include lib-ngt.js
const p = $('Prepare').first().json;
return [{ json: { candidate_id: p.duplicate_of, event: 'duplicate_application', detail: 'Applied again on ' + DateTime.now().setZone(TZ).toFormat('d LLL yyyy HH:mm') + ' with ' + p.cv_filename + '. The new CV was not screened.', actor: 'system', at: nowIso() } }];
