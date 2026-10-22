// The owner's dashboard, with all the data in the page. Needs the key from Settings.
// @include lib-mgv.js
// @include lib-dash.js
const PAGE =
__HTML_DASHBOARD__
;
const query = $('Dashboard Request').first().json.query || {};
const T = tablesOf($('Load All').first().json);
const s = settingsOf(T.Settings);
if (!s.dashboard_key || String(query.key || '') !== String(s.dashboard_key)) return [{ json: { code: 403, html: pageHtml(s, 'Wrong link', '<p>This dashboard link is not valid. Use the link with the key from the Settings tab.</p>') } }];
return [{ json: { code: 200, html: PAGE.replace('/*__DATA__*/null', JSON.stringify(dashData(T, s)).replace(/</g, '\\u003c')) } }];
