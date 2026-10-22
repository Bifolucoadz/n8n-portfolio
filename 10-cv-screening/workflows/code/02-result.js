// What the caller gets back (handy in test runs).
const c = $('Decide').first().json;
return [{ json: { candidate_id: c.candidate_id, job_id: c.job_id, band: c.band, score: c.score, flags: JSON.parse(c.flags_json).map(f => f.code), screen_ms: c.screen_ms, summary: c.summary } }];
