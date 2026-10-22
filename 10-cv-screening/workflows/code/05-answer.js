// The outcome for the dashboard: what happened, or why nothing did.
const plan = $('Plan').first().json;
if (plan.route === 'refuse') return [{ json: { ok: false, message: plan.message } }];
const ch = $('Apply Change').first().json;
return [{ json: ch.answer }];
