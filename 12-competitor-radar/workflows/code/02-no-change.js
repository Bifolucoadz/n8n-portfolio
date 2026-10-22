// Nothing new (same fingerprint as last time), or the page couldn't be fetched. Three failures in a row
// raise a "page down" change.
// @include lib-cs.js
const input = $('When Called').first().json;
const page = input.page;
const read = $('Read Page').first().json;
const at = input.as_of || nowIso();
const base = { page_id: page.page_id, competitor: page.competitor, page_type: page.page_type };
if (read.ok) return [{ json: Object.assign({}, base, { status: 'unchanged', method: page.last_method || read.method, at, items: parseJson(page.last_items_json, []), changes: [], ai_used: false,
  state: { page_id: page.page_id, last_checked: at, last_status: 'unchanged', fail_count: 0 } }) }];
const fails = (Number(page.fail_count) || 0) + 1;
const changes = fails === 3 ? [Object.assign({ kind: 'fetch_failed', item: page.page_type + ' page', before: 'working', after: read.error, detail: 'Failed 3 checks in a row' }, base)] : [];
return [{ json: Object.assign({}, base, { status: 'failed', method: page.last_method || '', at, items: [], changes, ai_used: false, error: read.error,
  state: { page_id: page.page_id, last_checked: at, last_status: 'failed: ' + read.error, fail_count: fails } }) }];
