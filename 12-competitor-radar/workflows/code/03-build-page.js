// The radar dashboard with its data. Needs the key from Settings.
// @include lib-cs.js
// @include lib-radar-dash.js
const PAGE =
__HTML_DASHBOARD__
;
const query = $('Dashboard Request').first().json.query || {};
const T = tablesOf($('Load All').first().json);
const s = settingsOf(T.Settings);
if (!s.dashboard_key || String(query.key || '') !== String(s.dashboard_key)) return [{ json: { code: 403, html: pageHtml('Wrong link', '<p>This dashboard link is not valid. Use the link with the key from the Settings tab.</p>') } }];
return [{ json: { code: 200, html: PAGE.replace('/*__DATA__*/null', JSON.stringify(radarData(T, s)).replace(/</g, '\\u003c')) } }];
