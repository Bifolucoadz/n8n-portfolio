// Live mode only: one item per email for Gmail (test mode wrote them to the Outbox tab in the batch).
const plan = $('When Called').first().json.plan || {};
if (plan.mode !== 'live') return [];
return (plan.emails || []).filter(e => e.to).map(e => ({ json: e }));
