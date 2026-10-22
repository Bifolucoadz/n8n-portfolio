// Rows to add to the Watchlist tab (arrays and objects as JSON text).
const plan = $('When Called').first().json.plan || {};
return ((plan.appends || {})['Watchlist'] || []).map(o => {
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  return { json: r };
});
