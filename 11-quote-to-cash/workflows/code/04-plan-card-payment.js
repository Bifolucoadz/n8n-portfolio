// Records a Stripe card payment once Stripe confirms the session is paid. Safe to receive twice.
// @include lib-mgv.js
// @include lib-pay.js
const session = $('Get Stripe Session').first().json;
const T = tablesOf($('Load Quote (Stripe)').first().json);
const s = settingsOf(T.Settings);
const meta = session.metadata || {};
const q = quoteOf((T.Quotes || []).find(r => meta.token && String(r.token) === String(meta.token)));
const p = payable(q, String(meta.kind || ''));
if (session.payment_status !== 'paid' || !p.ok) return [{ json: { ok: false, message: session.payment_status !== 'paid' ? 'Not paid' : p.message } }];
if (Math.round(p.amount * 100) !== Number(session.amount_total)) return [{ json: { ok: false, message: 'Amount does not match the quote' } }];
const plan = emptyPlan(s);
planPayment(plan, q, meta.kind, 'card (Stripe)', String(session.payment_intent || session.id), T, s, 'client');
plan.result = { ok: true };
return [{ json: { ok: true, plan } }];
