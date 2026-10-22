// What the caller gets back. Runs last (lowest branch), so it is the sub-workflow's output.
const plan = $('When Called').first().json.plan || {};
return [{ json: Object.assign({ ok: true }, plan.result || {}) }];
