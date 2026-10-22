// Only requests carrying the dashboard key may change anything.
// @include lib-ngt.js
const b = $('Action Request').first().json.body || {};
const s = settingsOf($('Read Settings (Action)').all());
const ok = !!s.dashboard_key && b.key === s.dashboard_key && /^C\d{4}-[A-Z0-9]{4}$/.test(String(b.candidate_id || '')) && ['invite', 'reject', 'hold'].includes(b.action);
return [{ json: { ok, candidate_id: String(b.candidate_id || ''), action: String(b.action || ''), actor: s.recruiter_name || 'recruiter' } }];
