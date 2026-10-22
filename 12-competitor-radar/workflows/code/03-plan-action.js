// Dashboard buttons: mark changes as seen, watch a new page, or check everything now.
// @include lib-cs.js
const body = $('Dashboard Action').first().json.body || {};
const T = tablesOf($('Load All (Action)').first().json);
const s = settingsOf(T.Settings);
const no = (message, code) => [{ json: { ok: false, code: code || 400, message } }];
if (!s.dashboard_key || String(body.key || '') !== String(s.dashboard_key)) return no('Not allowed.', 403);
const plan = emptyPlan(s);
if (body.action === 'check_now') return [{ json: { ok: true, route: 'run', plan } }];
if (body.action === 'seen') {
  const ids = new Set((T.Changes || []).map(c => c.change_id));
  const want = (Array.isArray(body.change_ids) ? body.change_ids : []).map(String).filter(id => ids.has(id)).slice(0, 500);
  if (!want.length) return no('Nothing to mark.');
  plan.updates.Changes = want.map(id => ({ change_id: id, status: 'seen' }));
  plan.result = { ok: true, message: want.length === 1 ? 'Marked as seen' : want.length + ' changes marked as seen' };
} else if (body.action === 'add_page') {
  const url = String(body.url || '').trim(), competitor = String(body.competitor || '').trim().slice(0, 60), type = String(body.page_type || '');
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) return no('That URL doesn\'t look right.');
  if (!competitor) return no('Add the competitor\'s name.');
  if (!['products', 'home', 'careers', 'news'].includes(type)) return no('Pick a page type.');
  if ((T.Watchlist || []).some(w => String(w.url).replace(/\/$/, '') === url.replace(/\/$/, ''))) return no('That page is already on the watchlist.');
  const page_id = competitor.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3) + '-' + type.toUpperCase().slice(0, 4) + '-' + newId('', 3);
  plan.appends.Watchlist.push({ page_id, competitor, page_type: type, url, active: 'yes', last_status: 'new', fail_count: 0, note: 'Added from the dashboard ' + day(nowIso()) });
  plan.result = { ok: true, message: 'Watching ' + competitor + ' (' + type + '). The first check takes a snapshot.' };
} else return no('Unknown action.');
return [{ json: { ok: true, route: 'save', plan } }];
