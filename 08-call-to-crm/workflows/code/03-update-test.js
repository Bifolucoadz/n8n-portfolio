// Only the fields being changed, so the rest of the deal row is left alone.
// @include lib-tdw.js
const i = $('Route').first().json;
const f = i.fields || {};
const out = { deal_id: i.deal_id, updated_at: nowIso() };
for (const k of ['stage', 'amount', 'close_date', 'next_step']) if (f[k] !== undefined && f[k] !== null && f[k] !== '') out[k] = f[k];
return [{ json: out }];
