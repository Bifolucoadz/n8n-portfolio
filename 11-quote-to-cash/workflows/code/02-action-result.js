// Sends the dashboard fresh data after the change, so it updates without reloading.
// @include lib-mgv.js
// @include lib-dash.js
const T = tablesOf($('Load All (After)').first().json);
const s = settingsOf(T.Settings);
const r = $('Plan Owner Action').first().json.plan.result;
return [{ json: { ok: true, message: r.message, data: dashData(T, s) } }];
