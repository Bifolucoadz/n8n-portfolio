// Changes to existing Changes rows, matched on change_id; only the columns given are updated.
const plan = $('When Called').first().json.plan || {};
return ((plan.updates || {})['Changes'] || []).map(o => {
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  return { json: r };
});
