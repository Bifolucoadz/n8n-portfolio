// The booked event, the same shape in both modes.
const r = $('Route').first().json;
const e = $input.first().json || {};
return [{ json: { booked: true, event_id: String(e.id || ''), link: e.htmlLink || '', start: r.start, end: r.end } }];
