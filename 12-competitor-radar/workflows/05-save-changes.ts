import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '7rH5EpTCyRAbJqwK', name: 'Gmail account 2' } };
const DOC = { __rl: true, mode: 'id', value: '1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g', cachedResultName: 'Cobble & Spoke: Competitor Radar' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 760], parameters: { inputSource: 'passthrough' } },
  output: [{ plan: { mode: 'test', appends: {}, updates: {}, emails: [], result: { ok: true } } }]
});

const aChangesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changes Rows', position: [440, 80], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Rows to add to the Changes tab (arrays and objects as JSON text).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.appends || {})[\'Changes\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{}]
});

const aChangesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Changes',
    position: [680, 80],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Changes' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'change_id', displayName: 'change_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'detected_at', displayName: 'detected_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_id', displayName: 'page_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_type', displayName: 'page_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'item', displayName: 'item', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'before', displayName: 'before', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'after', displayName: 'after', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'delta_pct', displayName: 'delta_pct', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_sku', displayName: 'our_sku', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_price', displayName: 'our_price', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'significance', displayName: 'significance', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'headline', displayName: 'headline', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'why_it_matters', displayName: 'why_it_matters', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'suggested_action', displayName: 'suggested_action', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'alerted', displayName: 'alerted', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aPricesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prices Rows', position: [440, 240], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Rows to add to the Prices tab (arrays and objects as JSON text).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.appends || {})[\'Prices\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{}]
});

const aPricesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Prices',
    position: [680, 240],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Prices' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'checked_at', displayName: 'checked_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'product', displayName: 'product', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'price', displayName: 'price', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'was_price', displayName: 'was_price', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'in_stock', displayName: 'in_stock', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_id', displayName: 'page_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_sku', displayName: 'our_sku', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aRunsRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Runs Rows', position: [440, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Rows to add to the Runs tab (arrays and objects as JSON text).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.appends || {})[\'Runs\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{}]
});

const aRunsWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Log Run',
    position: [680, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Runs' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'started_at', displayName: 'started_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'finished_at', displayName: 'finished_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'trigger', displayName: 'trigger', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'pages', displayName: 'pages', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'unchanged', displayName: 'unchanged', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'changed', displayName: 'changed', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'failed', displayName: 'failed', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'changes', displayName: 'changes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'alerts', displayName: 'alerts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ai_calls', displayName: 'ai_calls', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ms', displayName: 'ms', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aMatchesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Matches Rows', position: [440, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Rows to add to the Matches tab (arrays and objects as JSON text).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.appends || {})[\'Matches\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{}]
});

const aMatchesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Matches',
    position: [680, 560],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Matches' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor_product', displayName: 'competitor_product', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_sku', displayName: 'our_sku', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'confidence', displayName: 'confidence', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'matched_by', displayName: 'matched_by', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'matched_at', displayName: 'matched_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const aWatchlistRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Watchlist Rows', position: [440, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Rows to add to the Watchlist tab (arrays and objects as JSON text).\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.appends || {})[\'Watchlist\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{}]
});

const aWatchlistWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Pages',
    position: [680, 720],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Watchlist' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'page_id', displayName: 'page_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_type', displayName: 'page_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'active', displayName: 'active', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_checked', displayName: 'last_checked', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_status', displayName: 'last_status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_hash', displayName: 'last_hash', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_method', displayName: 'last_method', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fail_count', displayName: 'fail_count', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_items_json', displayName: 'last_items_json', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_text', displayName: 'last_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const uWatchlistRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Watchlist Updates', position: [440, 880], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Changes to existing Watchlist rows, matched on page_id; only the columns given are updated.\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.updates || {})[\'Watchlist\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{ page_id: 'X' }]
});

const uWatchlistWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Pages',
    position: [680, 880],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Watchlist' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['page_id'], schema: [
          { id: 'page_id', displayName: 'page_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_type', displayName: 'page_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'active', displayName: 'active', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_checked', displayName: 'last_checked', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_status', displayName: 'last_status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_hash', displayName: 'last_hash', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_method', displayName: 'last_method', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fail_count', displayName: 'fail_count', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_items_json', displayName: 'last_items_json', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_text', displayName: 'last_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ page_id: 'X' }]
});

const uChangesRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changes Updates', position: [440, 1040], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Changes to existing Changes rows, matched on change_id; only the columns given are updated.\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return ((plan.updates || {})[\'Changes\'] || []).map(o => {\n' +
        '  const r = {};\n' +
        '  for (const [k, v] of Object.entries(o)) r[k] = v === null || v === undefined ? \'\' : (typeof v === \'object\' ? JSON.stringify(v) : v);\n' +
        '  return { json: r };\n' +
        '});\n'
  } },
  output: [{ change_id: 'X' }]
});

const uChangesWrite = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Changes',
    position: [680, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Changes' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['change_id'], schema: [
          { id: 'change_id', displayName: 'change_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'detected_at', displayName: 'detected_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'competitor', displayName: 'competitor', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_id', displayName: 'page_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page_type', displayName: 'page_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'item', displayName: 'item', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'before', displayName: 'before', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'after', displayName: 'after', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'delta_pct', displayName: 'delta_pct', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_sku', displayName: 'our_sku', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'our_price', displayName: 'our_price', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'significance', displayName: 'significance', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'headline', displayName: 'headline', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'why_it_matters', displayName: 'why_it_matters', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'suggested_action', displayName: 'suggested_action', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'alerted', displayName: 'alerted', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ change_id: 'X' }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [440, 1200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One item per email: Gmail in live mode, the Outbox tab in test mode.\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'const live = plan.mode === \'live\';\n' +
        'return (plan.emails || []).filter(e => e.to).map(e => ({ json: Object.assign({}, e, { live, at: DateTime.now().setZone(\'Europe/London\').set({ millisecond: 0 }).toISO({ suppressMilliseconds: true }) }) }));\n'
  } },
  output: [{ to: 'team@cobblespoke.example', subject: 'Alert', html: '<p>Hi</p>', kind: 'alert', links: '', live: false, at: '2026-10-22T07:05:00+01:00' }]
});

const isLive = ifElse({
  version: 2.2,
  config: {
    name: 'Live Mode?',
    position: [680, 1200],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.live }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const gmail = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Email',
    position: [920, 1120],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      resource: 'message', operation: 'send',
      sendTo: expr('{{ $json.to }}'), subject: expr('{{ $json.subject }}'), emailType: 'html', message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Competitor Radar' }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: 'msg1' }]
});

const outbox = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Write to Outbox',
    position: [920, 1280],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Outbox' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'to', displayName: 'to', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'subject', displayName: 'subject', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'kind', displayName: 'kind', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'links', displayName: 'links', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'html', displayName: 'html', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [440, 1400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the caller gets back. Runs last (lowest branch), so it is the sub-workflow\'s output.\n' +
        'const plan = $(\'When Called\').first().json.plan || {};\n' +
        'return [{ json: Object.assign({ ok: true }, plan.result || {}) }];\n'
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Radar 5: Save Changes\nThe other radar workflows decide what to write in code (a **plan**) and hand it here: new changes, price history, the run log, product matches and new pages are added; page states and "seen" flags are updated (only the columns given, as plain text). Alert and digest emails go out with Gmail in live mode or to the **Outbox** tab in test mode. **Result** runs last and is returned to the caller.',
  [], { position: [160, -140], width: 1000, height: 180, color: 7 }
);

export default workflow('radar-save-changes', 'Radar 5: Save Changes')
  .add(whenCalled.to(aChangesRows.to(aChangesWrite)))
  .add(whenCalled.to(aPricesRows.to(aPricesWrite)))
  .add(whenCalled.to(aRunsRows.to(aRunsWrite)))
  .add(whenCalled.to(aMatchesRows.to(aMatchesWrite)))
  .add(whenCalled.to(aWatchlistRows.to(aWatchlistWrite)))
  .add(whenCalled.to(uWatchlistRows.to(uWatchlistWrite)))
  .add(whenCalled.to(uChangesRows.to(uChangesWrite)))
  .add(whenCalled.to(emails.to(isLive.onTrue(gmail).onFalse(outbox))))
  .add(whenCalled.to(result))
  .add(note);
