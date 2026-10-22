// The call row after review.
const p = $('Plan').first().json;
return [{ json: { call_id: p.call_id, ...p.row } }];
