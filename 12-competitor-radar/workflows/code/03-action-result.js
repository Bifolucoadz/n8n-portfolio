// Fresh data for the dashboard after the action.
// @include lib-cs.js
// @include lib-radar-dash.js
const T = tablesOf($('Load All (After)').first().json);
const s = settingsOf(T.Settings);
let message = $('Plan Action').first().json.plan.result.message;
if ($('Run Checks').isExecuted) {
  const r = $('Run Checks').first().json;
  message = 'Checked ' + r.pages + ' pages: ' + (r.changes ? r.changes + ' change' + (r.changes === 1 ? '' : 's') + (r.alerts ? ', ' + r.alerts + ' alert' + (r.alerts === 1 ? '' : 's') + ' sent' : '') : 'nothing new') + '.';
}
return [{ json: { ok: true, message, data: radarData(T, s) } }];
