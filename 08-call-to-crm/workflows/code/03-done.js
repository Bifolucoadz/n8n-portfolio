// The same answer shape for every write, in both modes.
const i = $('Route').first().json;
return [{ json: { ok: true, action: i.action, deal_id: i.deal_id, title: i.title || '', id: String(($input.first().json || {}).activity_id || ($input.first().json || {}).id || '') } }];
