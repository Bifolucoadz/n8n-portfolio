// Stripe tells us a checkout finished. We don't trust the message itself: the next node asks Stripe for
// the session by its ID (with our secret key) and only that answer is used.
const body = $('Stripe Webhook').first().json.body || {};
const obj = (body.data && body.data.object) || {};
const ok = body.type === 'checkout.session.completed' && /^cs_/.test(String(obj.id || ''));
return [{ json: { ok, session_id: ok ? obj.id : '' } }];
