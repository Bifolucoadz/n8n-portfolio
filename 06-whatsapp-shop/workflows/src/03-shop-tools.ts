import { workflow, node, trigger, sticky, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const PRODUCTS_TABLE = { __rl: true, mode: 'id', value: 'Z1zpXdhWaw6s43du', cachedResultName: 'Honeycrumb Products' };
const ZONES_TABLE = { __rl: true, mode: 'id', value: 'edO4Fs5LOquec5e1', cachedResultName: 'Honeycrumb Zones' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const CHATS_TABLE = { __rl: true, mode: 'id', value: 'pz1RGq7g1nLY7stj', cachedResultName: 'Honeycrumb Chats' };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const PHONE_FILTER = { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr("{{ $('Config').first().json.phone }}") }] };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [200, 800],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'action', type: 'string' },
          { name: 'phone', type: 'string' },
          { name: 'customer_name', type: 'string' },
          { name: 'turn_id', type: 'string' },
          { name: 'test', type: 'boolean' },
          { name: 'query', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'sku', type: 'string' },
          { name: 'qty', type: 'number' },
          { name: 'op', type: 'string' },
          { name: 'cake_message', type: 'string' },
          { name: 'area', type: 'string' },
          { name: 'fulfilment', type: 'string' },
          { name: 'address', type: 'string' },
          { name: 'deliver_on', type: 'string' },
          { name: 'window', type: 'string' },
          { name: 'note', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'reason', type: 'string' }
        ]
      }
    }
  },
  output: [{ action: 'search_menu', phone: '2348010000000', query: 'red velvet', test: true }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 800], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'payments', value: 'mock' }]
});

const config = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Config', position: [640, 800], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CONFIG__
  } },
  output: [{ action: 'search_menu', phone: '2348010000000', query: 'red velvet', op: 'view', settings: { payments: 'mock' } }]
});

const whichAction = switchCase({
  version: 3.2,
  config: {
    name: 'Which Action?',
    position: [860, 800],
    parameters: {
      rules: {
        values: [
          { outputKey: 'menu', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'search_menu' }], combinator: 'and' } },
          { outputKey: 'cart', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'update_cart' }], combinator: 'and' } },
          { outputKey: 'delivery', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'delivery_quote' }], combinator: 'and' } },
          { outputKey: 'checkout', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'checkout' }], combinator: 'and' } },
          { outputKey: 'status', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'order_status' }], combinator: 'and' } },
          { outputKey: 'human', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.action }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'request_human' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'other' }
    }
  }
});

// ---- search_menu ----
const readProducts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products', position: [1100, 160], parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', name: 'Red Velvet Celebration Cake, 6-inch', category: 'cakes', price_ngn: 38000, lead_hours: 48, available: true }]
});

const searchMenu = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Search Menu', position: [1320, 160], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SEARCH_MENU__
  } },
  output: [{ result: 'Red Velvet Celebration Cake, 6-inch [CK-RV6]: ₦38,000' }]
});

// ---- update_cart ----
const readProductsCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products (Cart)', position: [1100, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', name: 'Red Velvet Celebration Cake, 6-inch', category: 'cakes', price_ngn: 38000, lead_hours: 48, available: true }]
});

const readOrdersCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Cart)', position: [1320, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', phone: '2348010000000', status: 'cart', items_json: '[]' }]
});

const applyCart = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Apply Cart', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__APPLY_CART__
  } },
  output: [{ write: true, result: 'Cart HC-7K2Q: 1 × Red Velvet Celebration Cake, 6-inch = ₦38,000', row: { order_id: 'HC-7K2Q', phone: '2348010000000', status: 'cart' } }]
});

const shouldSave = ifElse({
  version: 2.2,
  config: {
    name: 'Cart Changed?',
    position: [1760, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.write }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const saveCart = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Cart',
    position: [1980, 340],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.row.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
__ORDER_MAP_ROW__
        },
        schema: [
__ORDER_SCHEMA__
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q' }]
});

const cartResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Cart Result', position: [2200, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CART_RESULT__
  } },
  output: [{ result: 'Cart HC-7K2Q: 1 × Red Velvet Celebration Cake, 6-inch = ₦38,000' }]
});

// ---- delivery_quote ----
const readZones = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Zones', position: [1100, 620], parameters: { resource: 'row', operation: 'get', dataTableId: ZONES_TABLE, returnAll: true } },
  output: [{ area: 'Lekki Phase 1', aliases: 'lekki', fee_ngn: 2000, eta: '1-2 hours', covered: true }]
});

const deliveryQuote = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Delivery Quote', position: [1320, 620], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DELIVERY_QUOTE__
  } },
  output: [{ result: 'Delivery to Lekki Phase 1: ₦2,000' }]
});

// ---- checkout ----
const readProductsCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Products (Checkout)', position: [1100, 860], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: PRODUCTS_TABLE, returnAll: true } },
  output: [{ sku: 'CK-RV6', price_ngn: 38000, lead_hours: 48, available: true }]
});

const readZonesCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Zones (Checkout)', position: [1320, 860], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: ZONES_TABLE, returnAll: true } },
  output: [{ area: 'Lekki Phase 1', fee_ngn: 2000, covered: true }]
});

const readOrdersCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Checkout)', position: [1540, 860], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', status: 'cart', items_json: '[]' }]
});

const validateCheckout = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Validate Checkout', position: [1760, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__VALIDATE_CHECKOUT__
  } },
  output: [{ ok: true, mode: 'mock', row: { order_id: 'HC-7K2Q', total_ngn: 40000 }, paystack: { email: 'a@b.co', amount: 4000000 } }]
});

const checkoutOk = ifElse({
  version: 2.2,
  config: {
    name: 'Ready To Pay?',
    position: [1980, 860],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const usePaystack = ifElse({
  version: 2.2,
  config: {
    name: 'Paystack Mode?',
    position: [2200, 800],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.mode }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'paystack' }], combinator: 'and' } }
  }
});

const paystackInit = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Paystack Initialize',
    position: [2420, 740],
    onError: 'continueRegularOutput',
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1500,
    parameters: {
      method: 'POST',
      url: 'https://api.paystack.co/transaction/initialize',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.paystack) }}'),
      options: { timeout: 15000 }
    },
    credentials: { httpHeaderAuth: newCredential('Paystack Test') }
  },
  output: [{ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'HC-7K2Q-101500' } }]
});

const attachPayment = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Attach Payment', position: [2640, 800], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ATTACH_PAYMENT__
  } },
  output: [{ order_id: 'HC-7K2Q', status: 'awaiting_payment', pay_url: 'https://checkout.paystack.com/abc', _ok: true }]
});

const saveCheckout = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Checkout',
    position: [2860, 800],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: ORDERS_TABLE,
      filters: { conditions: [{ keyName: 'order_id', condition: 'eq', keyValue: expr('{{ $json.order_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
__ORDER_MAP_JSON__
        },
        schema: [
__ORDER_SCHEMA__
        ]
      }
    }
  },
  output: [{ order_id: 'HC-7K2Q' }]
});

const checkoutResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Checkout Result', position: [3080, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECKOUT_RESULT__
  } },
  output: [{ result: 'Order HC-7K2Q is ready for payment.' }]
});

// ---- order_status ----
const readOrdersStatus = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Orders (Status)', position: [1100, 1080], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, filters: PHONE_FILTER, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ order_id: 'HC-7K2Q', status: 'paid', total_ngn: 40000 }]
});

const orderStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Order Status', position: [1320, 1080], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ORDER_STATUS__
  } },
  output: [{ result: 'HC-7K2Q: paid, queued for baking' }]
});

// ---- request_human ----
const readChats = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Recent Chats', position: [1100, 1300], alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CHATS_TABLE, filters: PHONE_FILTER, limit: 6, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' } },
  output: [{ phone: '2348010000000', role: 'user', text: 'I want to speak to someone' }]
});

const handoff = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Handoff', position: [1320, 1300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__HANDOFF__
  } },
  output: [{ phone: '2348010000000', handoff_until: '2026-10-28T12:00:00.000+01:00', chat_id: '42', telegram: 'Customer wants a person' }]
});

const saveHandoff = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Pause Bot',
    position: [1540, 1300],
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: CUSTOMERS_TABLE,
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.phone }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { phone: expr('{{ $json.phone }}'), handoff_until: expr('{{ $json.handoff_until }}') },
        schema: [
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'handoff_until', displayName: 'handoff_until', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ phone: '2348010000000' }]
});

const ownerSet = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [1760, 1300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr("{{ $('Handoff').first().json.chat_id }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const alertOwner = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Alert Owner',
    position: [1980, 1240],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message', operation: 'sendMessage',
      chatId: expr("{{ $('Handoff').first().json.chat_id }}"),
      text: expr("{{ $('Handoff').first().json.telegram }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const handoffResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Handoff Result', position: [2200, 1300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__HANDOFF_RESULT__
  } },
  output: [{ result: 'Done: a team member has been alerted.' }]
});

const unknownAction = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Unknown Action', position: [1100, 1500], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UNKNOWN_ACTION__
  } },
  output: [{ result: 'Unknown action.' }]
});

const note = sticky(
  '## Honeycrumb 3: Shop Tools\nThe agent\'s tools, one `action` each. All money and rules are code (`lib-shop.js`): prices are read from **Honeycrumb Products** every time, totals are computed here, delivery fees come from **Honeycrumb Zones**, and checkout checks name, address, opening days, windows and the longest lead time in the cart before it creates the Paystack link.\n\nOne open cart per phone in **Honeycrumb Orders**. Changing the cart after checkout drops the old payment link. `payments = mock` in Settings fakes the link for tests before the Paystack key exists.',
  [], { position: [160, -60], width: 1100, height: 220, color: 5 }
);

export default workflow('honeycrumb-shop-tools', 'Honeycrumb 3: Shop Tools')
  .add(whenCalled)
  .to(readSettings)
  .to(config)
  .to(whichAction
    .onCase(0, readProducts.to(searchMenu))
    .onCase(1, readProductsCart.to(readOrdersCart).to(applyCart).to(shouldSave
      .onTrue(saveCart.to(cartResult))
      .onFalse(cartResult)))
    .onCase(2, readZones.to(deliveryQuote))
    .onCase(3, readProductsCheckout.to(readZonesCheckout).to(readOrdersCheckout).to(validateCheckout).to(checkoutOk
      .onTrue(usePaystack
        .onTrue(paystackInit.to(attachPayment))
        .onFalse(attachPayment))
      .onFalse(checkoutResult)))
    .onCase(4, readOrdersStatus.to(orderStatus))
    .onCase(5, readChats.to(handoff).to(saveHandoff).to(ownerSet.onTrue(alertOwner.to(handoffResult)).onFalse(handoffResult)))
    .onCase(6, unknownAction))
  .add(attachPayment)
  .to(saveCheckout)
  .to(checkoutResult)
  .add(note);
