// One result item for LinkedIn: ok with the post link, error, or skipped.
const p = $('Attach Image').first().json;
if (!p.need_li) return [{ json: { platform: 'linkedin', status: 'skipped' } }];
const j = $json;
if (j.urn) return [{ json: { platform: 'linkedin', status: 'ok', url: 'https://www.linkedin.com/feed/update/' + j.urn + '/' } }];
let error = String(j.error?.message || j.error || j.message || 'LinkedIn returned no post ID');
if (!p.linkedin_person) error = 'LinkedIn is not connected yet (run Social Autopilot 8: Check Connections). ' + error;
return [{ json: { platform: 'linkedin', status: 'error', error } }];
