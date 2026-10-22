import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: '@@OPENAI_CRED_ID@@', name: 'OpenAI account' } };
const FORM_CRED = { httpBasicAuth: { id: '@@FORM_CRED_ID@@', name: 'Mossgrove estimator login' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #f4f1ea;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #e3ddd0;\n' +
  '  --color-header: #1d2a24;\n' +
  '  --color-label: #3d4b44;\n' +
  '  --color-focus-border: #1f4d3a;\n' +
  '  --color-submit-btn-bg: #1f4d3a;\n' +
  '  --color-submit-btn-text: #ffffff;\n' +
  '  --border-radius-card: 16px;\n' +
  '  --border-radius-input: 10px;\n' +
  '  --font-size-header: 24px;\n' +
  '}\n' +
  '.form-header h1 { letter-spacing: -0.3px; }\n' +
  'button[type="submit"] { font-weight: 600; }\n';

const form = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Site Visit Form',
    position: [200, 300],
    parameters: {
      authentication: 'basicAuth',
      formTitle: 'Site visit',
      formDescription: 'Fill this in on your phone before you leave the garden. Type the measurements or record a voice memo; add up to three photos. A priced draft is ready in under a minute and nothing goes to the client until the owner sends it.<br><small>Mossgrove Landscapes is a demo company.</small>',
      formFields: { values: [
        { fieldLabel: 'Client name', fieldName: 'client_name', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Client email', fieldName: 'client_email', fieldType: 'email', requiredField: true },
        { fieldLabel: 'Client phone', fieldName: 'client_phone', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'Site address', fieldName: 'site_address', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Postcode', fieldName: 'postcode', fieldType: 'text', placeholder: 'e.g. BS6 5DN' },
        { fieldLabel: 'Estimator', fieldName: 'estimator', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Tom Hale' }, { option: 'Priya Nair' }] } },
        { fieldLabel: 'What does the client want? Measurements, materials, access', fieldName: 'notes', fieldType: 'textarea', placeholder: 'e.g. Sandstone patio off the kitchen, 6 m x 4 m, on lawn. Replace 12 m of fence on the left with closeboard. Maybe lights later.' },
        { fieldLabel: 'Voice memo (instead of or as well as notes)', fieldName: 'voice_memo', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.m4a,.mp3,.wav,.webm,.ogg,.mp4' },
        { fieldLabel: 'Photos (up to 3)', fieldName: 'photos', fieldType: 'file', multipleFiles: true, acceptFileTypes: '.jpg,.jpeg,.png,.webp' }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Draft the quote', path: 'mossgrove-site-visit', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    },
    credentials: FORM_CRED
  },
  output: [{ client_name: 'Grace Whitfield', client_email: 'grace.whitfield@example.com', client_phone: '', site_address: '41 Chesterfield Road, Bristol', postcode: 'BS6 5DN', estimator: 'Tom Hale', notes: 'Patio 6 x 4 on lawn' }]
});

const checkVisit = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Visit', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_VISIT__
  } },
  output: [{ ok: true, errors: [], client_name: 'Grace Whitfield', has_voice: false, voice_key: '', images: [], started_ms: 0 }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [640, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const problemPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [860, 540], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PROBLEM_PAGE__
  } },
  output: [{ html: '<html></html>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1080, 540], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const hasVoice = ifElse({
  version: 2.2,
  config: {
    name: 'Voice Memo?',
    position: [860, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.has_voice }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const transcribe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Transcribe',
    position: [1080, 160],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'multipart-form-data',
      bodyParameters: { parameters: [
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: expr('{{ $json.voice_key }}') },
        { parameterType: 'formData', name: 'model', value: 'gpt-4o-transcribe' },
        { parameterType: 'formData', name: 'response_format', value: 'json' },
        { parameterType: 'formData', name: 'prompt', value: 'Landscaping site visit: patio, porcelain, sandstone, sub-base, closeboard fence, gravel boards, sleepers, turf, m², metres.' }
      ] },
      options: { timeout: 180000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ text: 'Back garden, patio six by four metres on the lawn.' }]
});

const loadBook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Price Book',
    position: [1300, 300],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'GET',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=%27Price%20Book%27&ranges=Quotes&valueRenderOption=UNFORMATTED_VALUE',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ spreadsheetId: '1abc', valueRanges: [] }]
});

const buildRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Request', position: [1520, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_REQUEST__
  } },
  output: [{ transcript: '', body: {} }]
});

const draftQuote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Draft Quote (GPT-5.4)',
    position: [1740, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 180000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const readNumbers = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Read Quote Numbers',
    position: [1960, 300],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values/Quotes!A:A', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ values: [['quote_id'], ['Q-1009']] }]
});

const priceQuote = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Price Quote', position: [2180, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PRICE_QUOTE__
  } },
  output: [{ plan: {}, page: '<html></html>' }]
});

const saveDraft = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Draft', position: [2400, 300], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const draftReady = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Draft Ready', position: [2620, 300], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr("{{ $('Price Quote').first().json.page }}") } }
});

const note = sticky(
  '## Mossgrove 1: Site Visit → Draft Quote\nThe estimator fills in the form in the garden (notes, a voice memo, photos). The memo is transcribed, then **GPT-5.4 picks items and quantities from the price book** (it never sees or sets prices). **Price Quote** works out every amount, VAT, the deposit and the days of work in code, and flags anything to check. The draft is saved to Google Sheets and the owner gets an email; nothing goes to the client until the owner sends it from the dashboard.',
  [], { position: [160, -60], width: 1140, height: 180, color: 7 }
);

export default workflow('mossgrove-site-visit', 'Mossgrove 1: Site Visit to Draft Quote')
  .add(form)
  .to(checkVisit)
  .to(valid
    .onTrue(hasVoice
      .onTrue(transcribe.to(loadBook))
      .onFalse(loadBook))
    .onFalse(problemPage.to(showProblem)))
  .add(loadBook)
  .to(buildRequest)
  .to(draftQuote)
  .to(readNumbers)
  .to(priceQuote)
  .to(saveDraft)
  .to(draftReady)
  .add(note);
