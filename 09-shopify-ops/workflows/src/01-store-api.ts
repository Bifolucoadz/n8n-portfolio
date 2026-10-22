import { workflow, node, trigger, sticky, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const CHECKOUTS = { __rl: true, mode: 'id', value: 'XluYD3lO9tEeAhBS', cachedResultName: 'Kettle Checkouts' };
const REVIEWS = { __rl: true, mode: 'id', value: 'D2bbJsHicEHPMugS', cachedResultName: 'Kettle Reviews' };
const SHOPIFY_CRED = { httpHeaderAuth: newCredential('Shopify Admin token') };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 500], parameters: { inputSource: 'passthrough' } },
  output: [{ action: 'inventory' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 500], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 500], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ROUTE__
  } },
  output: [{ action: 'inventory', route: 'test_read', table_id: 'Ep9njyaWF13y9SHL' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 500],
    parameters: {
      rules: { values: [
        { outputKey: 'test read', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_read' }], combinator: 'and' } },
        { outputKey: 'live read', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_read' }], combinator: 'and' } },
        { outputKey: 'mark contacted', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'mark_contacted' }], combinator: 'and' } },
        { outputKey: 'tag reviews', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'tag_reviews' }], combinator: 'and' } }
      ] }
    }
  }
});

const readTable = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Table', position: [1100, 260], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: expr('{{ $json.table_id }}') }, returnAll: true } },
  output: [{ sku: 'EG-100', inventory: 140 }]
});

const shapeTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer (Test)', position: [1320, 260], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SHAPE_TEST__
  } },
  output: [{ products: [] }]
});

const gql = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'GraphQL Query', position: [1100, 460], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__GRAPHQL__
  } },
  output: [{ url: 'https://kettle-and-fern.myshopify.com/admin/api/2025-10/graphql.json', body: { query: '{ shop { name } }' } }]
});

const shopify = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Shopify GraphQL',
    position: [1320, 460],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'POST', url: expr('{{ $json.url }}'),
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: SHOPIFY_CRED
  },
  output: [{ data: {} }]
});

const shapeLive = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer (Live)', position: [1540, 460], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SHAPE_LIVE__
  } },
  output: [{ products: [] }]
});

const contactedRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Contacted Row', position: [1100, 660], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CONTACTED_ROW__
  } },
  output: [{ checkout_id: 'CK-7001', contacted_at: '2026-10-21T12:00:00.000-07:00', offer: 'WELCOME10' }]
});

const markContacted = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark Contacted',
    position: [1320, 660],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: CHECKOUTS,
      filters: { conditions: [{ keyName: 'checkout_id', condition: 'eq', keyValue: expr('{{ $json.checkout_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
        checkout_id: expr('{{ $json.checkout_id }}'),
__MAP_CONTACTED__
      }, schema: [
        { id: 'checkout_id', displayName: 'checkout_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
__SCHEMA_CONTACTED__
      ] }
    }
  },
  output: [{ id: 1 }]
});

const tagRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Tag Rows', position: [1100, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TAG_ROWS__
  } },
  output: [{ review_id: 'RV-5100', topics_json: '["shipping speed"]', sentiment: 'negative', issue: 'Slow delivery', analysed_at: '2026-10-21T12:00:00.000-07:00' }]
});

const saveTags = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Review Tags',
    position: [1320, 860],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: REVIEWS,
      filters: { conditions: [{ keyName: 'review_id', condition: 'eq', keyValue: expr('{{ $json.review_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
__MAP_REVIEWTAGS__
      }, schema: [
__SCHEMA_REVIEWTAGS__
      ] }
    }
  },
  output: [{ id: 1 }]
});

const done = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Done', position: [1540, 760], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DONE__
  } },
  output: [{ ok: true }]
});

const note = sticky(
  '## Kettle 1: Store API\nThe one place that talks to the store, so every other workflow works the same in test and live.\n- Reads: **abandoned_checkouts**, **orders_since**, **find_order** (number + email must both match), **inventory**, **reviews_since**.\n- Writes to our own tables: **mark_contacted** (never email a checkout twice), **tag_reviews**.\nLive mode reads the Shopify Admin GraphQL API (needs a **Shopify Admin token** credential: header `X-Shopify-Access-Token`); reviews come from the review app, kept in **Kettle Reviews**.',
  [], { position: [160, 0], width: 1300, height: 220, color: 7 }
);

export default workflow('kettle-store-api', 'Kettle 1: Store API')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(which
    .onCase(0, readTable.to(shapeTest))
    .onCase(1, gql.to(shopify).to(shapeLive))
    .onCase(2, contactedRow.to(markContacted).to(done))
    .onCase(3, tagRows.to(saveTags).to(done)))
  .add(note);
