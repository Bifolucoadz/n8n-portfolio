// One item per email: Gmail in live mode, the Outbox tab in test mode.
const plan = $('When Called').first().json.plan || {};
const live = plan.mode === 'live';
return (plan.emails || []).filter(e => e.to).map(e => ({ json: Object.assign({}, e, { live, at: DateTime.now().setZone('Europe/London').set({ millisecond: 0 }).toISO({ suppressMilliseconds: true }) }) }));
