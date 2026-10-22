// The review link must carry the call's private token.
// @include lib-tdw.js
const q = $('Review Link').first().json.query || {};
const c = $('Read Call').all().map(i => i.json).find(r => r.call_id === q.call) || null;
const ok = !!c && !!q.t && q.t === c.token;
return [{ json: { ok, action: 'get_deal', deal_id: c ? c.deal_id : '' } }];
