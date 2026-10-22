import { workflow, node, trigger, sticky, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const DEALS = { __rl: true, mode: 'id', value: '6fad2EyLoty9oElv', cachedResultName: 'Tidewater Deals' };
const COMPANIES = { __rl: true, mode: 'id', value: 'h1O24r8zgxQeqODi', cachedResultName: 'Tidewater Companies' };
const CONTACTS = { __rl: true, mode: 'id', value: '0jlx2ckch1Gj6Qtr', cachedResultName: 'Tidewater Contacts' };
const ACTIVITY = { __rl: true, mode: 'id', value: 'VUrS7HRsgmNpXROv', cachedResultName: 'Tidewater Activity' };
const HUBSPOT_CRED = { hubspotAppToken: newCredential('HubSpot account') };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 600], parameters: { inputSource: 'passthrough' } },
  output: [{ action: 'get_deal', deal_id: 'D-1001' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 600], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const route = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route', position: [640, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ROUTE__
  } },
  output: [{ action: 'get_deal', deal_id: 'D-1001', route: 'test_get_deal' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 600],
    parameters: {
      rules: { values: [
        { outputKey: 'test get deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_get_deal' }], combinator: 'and' } },
        { outputKey: 'test update deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'test_update_deal' }], combinator: 'and' } },
        { outputKey: 'test note or task', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^test_(add_note|create_task)$' }], combinator: 'and' } },
        { outputKey: 'live get deal', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'live_get_deal' }], combinator: 'and' } },
        { outputKey: 'live write', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^live_(update_deal|add_note|create_task)$' }], combinator: 'and' } }
      ] }
    }
  }
});

// Test CRM: read
const readDeal = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Deal', position: [1100, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: DEALS, returnAll: true, filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr("{{ $('Route').first().json.deal_id }}") }] } } },
  output: [{ deal_id: 'D-1001', name: 'Calloway Dental: patient reminders', company_id: 'C-201', stage: 'appointmentscheduled' }]
});
const readCompanies = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Companies', position: [1320, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: COMPANIES, returnAll: true } },
  output: [{ company_id: 'C-201', name: 'Calloway Dental Group' }]
});
const readContacts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Contacts', position: [1540, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CONTACTS, returnAll: true } },
  output: [{ contact_id: 'P-301', company_id: 'C-201', name: 'Renee Alvarez' }]
});
const readActivity = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Activity', position: [1760, 200], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ACTIVITY, returnAll: true, filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr("{{ $('Route').first().json.deal_id }}") }] } } },
  output: [{ deal_id: 'D-1001', kind: 'note', title: 'Inbound lead' }]
});
const dealTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Deal (Test)', position: [1980, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DEAL_TEST__
  } },
  output: [{ found: true, deal: {}, company: {}, contacts: [], activity: [] }]
});

// Test CRM: writes
const updateFields = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Changed Fields', position: [1100, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UPDATE_TEST__
  } },
  output: [{ deal_id: 'D-1001', stage: 'qualifiedtobuy', updated_at: '2026-10-21T14:00:00.000-04:00' }]
});
const updateDeal = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Deal Row',
    position: [1320, 420],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: DEALS,
      filters: { conditions: [{ keyName: 'deal_id', condition: 'eq', keyValue: expr('{{ $json.deal_id }}') }] },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
__SCHEMA_DEALS__
      ] }
    }
  },
  output: [{ id: 1 }]
});
const activityRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Activity Row', position: [1100, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ACTIVITY_TEST__
  } },
  output: [{ activity_id: 'N-ABCDE', deal_id: 'D-1001', kind: 'call', title: 'Call summary' }]
});
const addActivity = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Add Activity', position: [1320, 620], parameters: { resource: 'row', operation: 'insert', dataTableId: ACTIVITY, columns: { mappingMode: 'defineBelow', value: {
__MAP_ACTIVITY__
  }, schema: [
__SCHEMA_ACTIVITY__
  ] } } },
  output: [{ id: 5, activity_id: 'N-ABCDE' }]
});

// Live CRM (HubSpot)
const hsDeal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Deal',
    position: [1100, 860],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'GET',
      url: expr("https://api.hubapi.com/crm/v3/objects/deals/{{ encodeURIComponent($('Route').first().json.deal_id) }}?properties=dealname,dealstage,amount,closedate,hubspot_owner_id,hs_next_step&associations=companies,contacts"),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken'
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ id: '123', properties: { dealname: 'Calloway Dental: patient reminders' }, associations: { contacts: { results: [{ id: '501' }] } } }]
});
const hsContacts = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Contacts',
    position: [1320, 860],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts/batch/read',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ properties: ["firstname", "lastname", "email", "jobtitle"], inputs: ((($json.associations || {}).contacts || {}).results || []).map(c => ({ id: c.id })) }) }}'),
      options: {}
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ results: [] }]
});
const dealLive = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Deal (Live)', position: [1540, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DEAL_LIVE__
  } },
  output: [{ found: true, deal: {}, contacts: [] }]
});
const hsBody = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'HubSpot Request', position: [1100, 1060], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__HUBSPOT_BODY__
  } },
  output: [{ method: 'PATCH', url: 'https://api.hubapi.com/crm/v3/objects/deals/123', body: {} }]
});
const hsWrite = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HubSpot Write',
    position: [1320, 1060],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: expr('{{ $json.method }}'),
      url: expr('{{ $json.url }}'),
      authentication: 'predefinedCredentialType', nodeCredentialType: 'hubspotAppToken',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {}
    },
    credentials: HUBSPOT_CRED
  },
  output: [{ id: '777' }]
});

const done = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Done', position: [1760, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DONE__
  } },
  output: [{ ok: true, action: 'add_note' }]
});

const note = sticky(
  '## Tidewater 3: CRM\nThe only place that talks to the CRM, so the rest of the system doesn\'t care which one it is.\n- **get_deal**: the deal with its company, contacts and recent activity.\n- **update_deal**: changes only the fields given (stage, amount, close date, next step).\n- **add_note** / **create_task**: logged on the deal.\nTest mode uses the **Tidewater** tables. Live mode uses the HubSpot CRM API (deal properties, notes and tasks associated with the deal); those nodes stay off until a **HubSpot account** (private app token) credential exists.',
  [], { position: [160, 0], width: 1300, height: 200, color: 7 }
);

export default workflow('tidewater-crm', 'Tidewater 3: CRM')
  .add(whenCalled)
  .to(readSettings)
  .to(route)
  .to(which
    .onCase(0, readDeal.to(readCompanies).to(readContacts).to(readActivity).to(dealTest))
    .onCase(1, updateFields.to(updateDeal).to(done))
    .onCase(2, activityRow.to(addActivity).to(done))
    .onCase(3, hsDeal.to(hsContacts).to(dealLive))
    .onCase(4, hsBody.to(hsWrite).to(done)))
  .add(note);
