// Demo only: switch the invented competitor sites to week 1-4 (needs the demo key).
const q = $('Admin Request').first().json.query || {};
if (String(q.key || '') !== '@@DEMO_KEY@@') return [{ json: { code: 403, body: { ok: false, message: 'Wrong key' } } }];
const data = $getWorkflowStaticData('global');
if (q.week) data.week = Math.min(4, Math.max(1, Number(q.week) || 1));
return [{ json: { code: 200, body: { ok: true, week: data.week || 1 } } }];
