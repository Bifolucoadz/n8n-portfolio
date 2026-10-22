// Puts the radar's sheet back to the demo start: settings, our eight bikes, nine competitor pages to watch
// (the invented sites in Radar 0) and the known product matches. Prices, changes and runs start empty,
// so the first check takes a snapshot of every page.
// @include lib-cs.js
const base = 'http://localhost:5678/webhook/demo-web/page?site=';
const SETTINGS_ROWS = [
  ['mode', 'test', 'test: emails go to the Outbox tab. live: Gmail.'],
  ['company', 'Cobble & Spoke', ''],
  ['company_about', 'an online e-bike shop in Edinburgh, Scotland, selling across the UK', 'Tells the AI who "we" are.'],
  ['alert_email', 'team@cobblespoke.example', 'Gets alerts and the Monday digest.'],
  ['alert_threshold', 4, 'Changes rated this or higher are emailed straight away (1-5).'],
  ['undercut_pct', 3, 'A rival this % or more below our matched bike is always rated 4+.'],
  ['big_drop_pct', 15, 'A price cut this big is always rated 4+.'],
  ['ignore_lines', 'DEMO SITE:|cookie|©', 'Lines containing these (| separated) are ignored when comparing pages.'],
  ['base_url', 'http://localhost:5678', 'Public address of n8n (dashboard link in emails).'],
  ['dashboard_key', '@@DASHBOARD_KEY@@', 'Key in the dashboard link.']
];
const PAGES = [
  ['TS-BIKES', 'Torque Street', 'products', 'torque-street&page=bikes'],
  ['TS-HOME', 'Torque Street', 'home', 'torque-street&page=home'],
  ['TS-JOBS', 'Torque Street', 'careers', 'torque-street&page=careers'],
  ['GV-SHOP', 'Glenvolt', 'products', 'glenvolt&page=shop'],
  ['GV-NEWS', 'Glenvolt', 'news', 'glenvolt&page=news'],
  ['PP-PRICES', 'Pedalpoint Electric', 'products', 'pedalpoint&page=prices'],
  ['PP-JOBS', 'Pedalpoint Electric', 'careers', 'pedalpoint&page=careers'],
  ['HT-RANGE', 'Hilltrack E-Bikes', 'products', 'hilltrack&page=range'],
  ['HT-HOME', 'Hilltrack E-Bikes', 'home', 'hilltrack&page=home']
];
const OURS = [
  ['CS-METRO', 'Metro 500', 'commuter', 1799, 500, 110, '250 W hub'],
  ['CS-FOLD', 'Fold 300', 'folding', 1349, 300, 60, '250 W hub'],
  ['CS-STEP', 'City Step 400', 'step-through city', 1499, 400, 80, '250 W hub'],
  ['CS-URBAN', 'Urban Lite', 'lightweight city', 1199, 250, 50, '250 W rear hub'],
  ['CS-GRAVEL', 'Gravel 500', 'gravel', 2499, 500, 100, '250 W mid-drive'],
  ['CS-TOUR', 'Tour 750', 'trekking', 2699, 750, 150, '250 W mid-drive'],
  ['CS-TRAIL', 'Trail 625', 'mountain hardtail', 2899, 625, 90, '85 Nm mid-drive'],
  ['CS-CARGO', 'Cargo Long', 'longtail cargo', 4299, 750, 100, '85 Nm mid-drive']
];
const MATCHES = [
  ['Torque Street', 'Commuter One', 'CS-METRO', 'high'], ['Torque Street', 'Fold Mini', 'CS-FOLD', 'high'], ['Torque Street', 'Ridge 625', 'CS-TRAIL', 'high'], ['Torque Street', 'Cargo Duo', 'CS-CARGO', 'high'],
  ['Glenvolt', 'Clyde City', 'CS-METRO', 'high'], ['Glenvolt', 'Highland Trail', 'CS-TRAIL', 'medium'], ['Glenvolt', 'Step-Through', 'CS-STEP', 'high'], ['Glenvolt', 'Glenvolt Fold', 'CS-FOLD', 'high'],
  ['Pedalpoint Electric', 'Pedalpoint Metro', 'CS-METRO', 'high'], ['Pedalpoint Electric', 'Trekker 750', 'CS-TOUR', 'high'], ['Pedalpoint Electric', 'Pedalpoint Cargo', 'CS-CARGO', 'high'], ['Pedalpoint Electric', 'Urban Single', 'CS-URBAN', 'high'],
  ['Hilltrack E-Bikes', 'Pennine 625', 'CS-TRAIL', 'medium'], ['Hilltrack E-Bikes', 'Dales Gravel', 'CS-GRAVEL', 'high'], ['Hilltrack E-Bikes', 'Moor Hardtail', 'CS-TRAIL', 'high']
];
const at = nowIso();
const tabs = {
  'Settings': [COLUMNS.Settings].concat(SETTINGS_ROWS),
  'Watchlist': [COLUMNS.Watchlist].concat(PAGES.map(p => COLUMNS.Watchlist.map(c => ({ page_id: p[0], competitor: p[1], page_type: p[2], url: base + p[3], active: 'yes', last_status: 'new', fail_count: 0, note: 'Demo site (Radar 0)' })[c] ?? ''))),
  'Our Products': [COLUMNS['Our Products']].concat(OURS.map(o => [o[0], o[1], o[2], o[3], o[4], o[5], o[6], 'https://example.com/cobble-spoke/' + o[0].toLowerCase()])),
  'Matches': [COLUMNS.Matches].concat(MATCHES.map(m => m.concat(['manual', at]))),
  'Prices': [COLUMNS.Prices], 'Changes': [COLUMNS.Changes], 'Runs': [COLUMNS.Runs], 'Outbox': [COLUMNS.Outbox]
};
const q = n => "'" + n.replace(/'/g, "''") + "'";
return [{ json: {
  clear: { ranges: Object.keys(tabs).map(q) },
  write: { valueInputOption: 'RAW', data: Object.entries(tabs).map(([n, v]) => ({ range: q(n) + '!A1', values: v })) },
  summary: Object.fromEntries(Object.entries(tabs).map(([n, v]) => [n, v.length - 1]))
} }];
