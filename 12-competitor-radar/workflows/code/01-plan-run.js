// Starts a run: one item per active page on the watchlist. A run started from the dashboard or a script
// needs the key; in test mode it can also pass `as_of` to stamp the run with another date (the demo
// replays four weeks in a few minutes).
// @include lib-cs.js
const T = tablesOf($('Load Watchlist').first().json);
const s = settingsOf(T.Settings);
let trigger = 'schedule', asOf = '';
if ($('Run Request').isExecuted) {
  const b = $('Run Request').first().json.body || {};
  if (!s.dashboard_key || String(b.key || '') !== String(s.dashboard_key)) throw new Error('Wrong key');
  trigger = 'webhook';
  if (b.as_of && s.mode !== 'live') asOf = isoOf(toDt(b.as_of));
} else if ($('When Called').isExecuted) trigger = 'dashboard';
else if ($('Run Now').isExecuted) trigger = 'manual';
const runId = newId('RUN-', 6);
const pages = (T.Watchlist || []).filter(p => p.page_id && p.url && (p.active === '' || truthy(p.active)));
return pages.map(p => ({ json: { run_id: runId, trigger, started_ms: Date.now(), as_of: asOf, ignore_lines: s.ignore_lines || '', page: p } }));
