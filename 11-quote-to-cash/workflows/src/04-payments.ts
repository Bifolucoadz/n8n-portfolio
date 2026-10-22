import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };
const LOAD_URL = 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Quotes&ranges=Schedule&valueRenderOption=UNFORMATTED_VALUE';
const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };
const IS_OK = { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' };

// Payment link: practice checkout (test) or Stripe Checkout (live)
const payHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Pay Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'mossgrove/pay', responseMode: 'responseNode', options: {} } },
  output: [{ query: { t: 'abc', kind: 'deposit' } }]
});

const loadQuote = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote',
    position: [420, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planCheckout = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Checkout', position: [640, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_CHECKOUT__
  } },
  output: [{ route: 'page', html: '<html></html>' }]
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'Route',
    position: [860, 300],
    parameters: { rules: { values: [
      { outputKey: 'page', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'page' }], combinator: 'and' } },
      { outputKey: 'stripe', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'stripe' }], combinator: 'and' } },
      { outputKey: 'message', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'message' }], combinator: 'and' } }
    ] }, options: {} }
  }
});

const sendCheckout = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Test Checkout', position: [1080, 160], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

const createSession = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Stripe Session',
    position: [1080, 300],
    parameters: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/checkout/sessions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'stripeApi',
      sendBody: true, contentType: 'form-urlencoded',
      bodyParameters: { parameters: [
        { name: 'mode', value: 'payment' },
        { name: 'success_url', value: expr('{{ $json.success_url }}') },
        { name: 'cancel_url', value: expr('{{ $json.cancel_url }}') },
        { name: 'customer_email', value: expr('{{ $json.email }}') },
        { name: 'line_items[0][quantity]', value: '1' },
        { name: 'line_items[0][price_data][currency]', value: expr('{{ $json.currency }}') },
        { name: 'line_items[0][price_data][unit_amount]', value: expr('{{ $json.pence }}') },
        { name: 'line_items[0][price_data][product_data][name]', value: expr('{{ $json.product }}') },
        { name: 'metadata[token]', value: expr('{{ $json.token }}') },
        { name: 'metadata[kind]', value: expr('{{ $json.kind }}') }
      ] },
      options: {}
    }
  },
  output: [{ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }]
});

const goStripe = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Go to Stripe', position: [1300, 300], parameters: { respondWith: 'redirect', redirectURL: expr('{{ $json.url }}'), options: {} } }
});

const sendMessage = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Message', position: [1080, 440], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseHeaders: HTML_HEADERS } } }
});

// Test checkout "pays"
const testHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Test Payment', position: [200, 720], parameters: { httpMethod: 'POST', path: 'mossgrove/pay-test', responseMode: 'responseNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { t: 'abc', kind: 'deposit', last4: '4242' } }]
});

const loadTest = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Test)',
    position: [420, 720],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planTest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Test Payment', position: [640, 720], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_TEST_PAYMENT__
  } },
  output: [{ ok: true, plan: {} }]
});

const testOk = ifElse({ version: 2.2, config: { name: 'Can Pay?', position: [860, 720], parameters: { conditions: IS_OK } } });

const saveTest = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Record Payment', position: [1080, 640], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const sendPaid = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Paid', position: [1300, 640], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: true, redirect: $json.redirect } }}'), options: {} } }
});

const refuseTest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Refuse Payment', position: [1080, 820], parameters: { respondWith: 'json', responseBody: expr('{{ { ok: false, message: $json.message } }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

// Stripe webhook (live)
const stripeHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Stripe Webhook', position: [200, 1120], parameters: { httpMethod: 'POST', path: 'mossgrove/stripe-webhook', responseMode: 'responseNode', options: {} } },
  output: [{ body: { type: 'checkout.session.completed', data: { object: { id: 'cs_test_123' } } } }]
});

const checkEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Event', position: [420, 1120], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_EVENT__
  } },
  output: [{ ok: true, session_id: 'cs_test_123' }]
});

const isCheckout = ifElse({ version: 2.2, config: { name: 'Checkout Completed?', position: [640, 1120], parameters: { conditions: IS_OK } } });

const getSession = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Stripe Session',
    position: [860, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: expr('https://api.stripe.com/v1/checkout/sessions/{{ $json.session_id }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'stripeApi', options: {} },
  },
  output: [{ id: 'cs_test_123', payment_status: 'paid', amount_total: 50220, metadata: { token: 'abc', kind: 'deposit' }, payment_intent: 'pi_123' }]
});

const loadStripe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Quote (Stripe)',
    position: [1080, 1040],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: { method: 'GET', url: LOAD_URL, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planCard = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Card Payment', position: [1300, 1040], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_CARD_PAYMENT__
  } },
  output: [{ ok: true, plan: {} }]
});

const cardOk = ifElse({ version: 2.2, config: { name: 'Paid?', position: [1520, 1040], parameters: { conditions: IS_OK } } });

const saveCard = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Record Card Payment', position: [1740, 960], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const ack = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Acknowledge', position: [1960, 960], parameters: { respondWith: 'json', responseBody: '{ "received": true }', options: {} } }
});

const ackIgnored = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Acknowledge (Ignored)', position: [1740, 1200], parameters: { respondWith: 'json', responseBody: '{ "received": true, "recorded": false }', options: {} } }
});

const note = sticky(
  '## Mossgrove 4: Payments and Booking\nThe client\'s **Pay** link. In test mode it shows a practice checkout (test card 4242…); in live mode it creates a **Stripe Checkout** session and redirects to it (add a Stripe credential and enable the two Stripe nodes). Stripe\'s webhook is never trusted on its own: the session is fetched back from Stripe and the amount checked. When a **deposit** is paid, the job is booked into the first crew with enough free working days after the lead time (from the **Schedule** tab) and the client gets the start date. When the **balance** is paid, the job is closed and a receipt goes out.',
  [], { position: [160, -60], width: 1360, height: 200, color: 7 }
);

export default workflow('mossgrove-payments', 'Mossgrove 4: Payments and Booking')
  .add(payHook)
  .to(loadQuote)
  .to(planCheckout)
  .to(route
    .onCase(0, sendCheckout)
    .onCase(1, createSession.to(goStripe))
    .onCase(2, sendMessage))
  .add(testHook)
  .to(loadTest)
  .to(planTest)
  .to(testOk
    .onTrue(saveTest.to(sendPaid))
    .onFalse(refuseTest))
  .add(stripeHook)
  .to(checkEvent)
  .to(isCheckout
    .onTrue(getSession.to(loadStripe.to(planCard.to(cardOk
      .onTrue(saveCard.to(ack))
      .onFalse(ackIgnored)))))
    .onFalse(ackIgnored))
  .add(note);
