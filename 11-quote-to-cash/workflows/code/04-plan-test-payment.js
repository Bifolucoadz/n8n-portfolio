// Test mode only: the practice checkout "pays". Records it exactly like a real card payment would be.
// @include lib-mgv.js
// @include lib-pay.js
const body = $('Test Payment').first().json.body || {};
const T = tablesOf($('Load Quote (Test)').first().json);
const s = settingsOf(T.Settings);
const token = String(body.t || ''), kind = String(body.kind || '');
const q = quoteOf((T.Quotes || []).find(r => token && String(r.token) === token));
if (s.mode === 'live') return [{ json: { ok: false, code: 403, message: 'Test payments are switched off.' } }];
const p = payable(q, kind);
if (!p.ok) return [{ json: { ok: false, code: 409, message: p.message } }];
const plan = emptyPlan(s);
planPayment(plan, q, kind, 'test card', 'test_' + newToken(14), T, s, 'client');
plan.result = { ok: true, redirect: 'quote?t=' + token + '&paid=' + kind };
return [{ json: { ok: true, plan } }];
