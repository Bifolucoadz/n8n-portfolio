import { workflow, node, trigger, sticky, ifElse, languageModel, tool, fromAi, newCredential, expr } from '@n8n/workflow-sdk';

const SETTINGS_TABLE = { __rl: true, mode: 'id', value: 'PJ1UINshV66iby3v', cachedResultName: 'Honeycrumb Settings' };
const ORDERS_TABLE = { __rl: true, mode: 'id', value: 'K3QpMm9jFMF8Daui', cachedResultName: 'Honeycrumb Orders' };
const CUSTOMERS_TABLE = { __rl: true, mode: 'id', value: 'QGkic5oor2SFHsoJ', cachedResultName: 'Honeycrumb Customers' };
const CHATS_TABLE = { __rl: true, mode: 'id', value: 'pz1RGq7g1nLY7stj', cachedResultName: 'Honeycrumb Chats' };
const TOOLS_WF = { __rl: true, mode: 'id', value: 'hcbShopTools0003', cachedResultName: 'Honeycrumb 3: Shop Tools' };
const SEND_WF = { __rl: true, mode: 'id', value: 'hcbSendWA0000004', cachedResultName: 'Honeycrumb 4: Send WhatsApp' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const WHATSAPP_CRED = { whatsAppApi: newCredential('WhatsApp account') };
const PHONE = "{{ $('Build Agent Input').first().json.phone }}";
const TURN = "{{ $('Build Agent Input').first().json.turn_id }}";
const TEST = "{{ $('Build Agent Input').first().json.test }}";
const NAME = "{{ $('Build Agent Input').first().json.name }}";
const TOOL_SCHEMA = [
  { id: 'action', displayName: 'action', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'turn_id', displayName: 'turn_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'test', displayName: 'test', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' },
  { id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'category', displayName: 'category', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'sku', displayName: 'sku', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'qty', displayName: 'qty', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' },
  { id: 'op', displayName: 'op', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'cake_message', displayName: 'cake_message', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'area', displayName: 'area', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'fulfilment', displayName: 'fulfilment', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'address', displayName: 'address', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'deliver_on', displayName: 'deliver_on', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'window', displayName: 'window', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'reason', displayName: 'reason', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
];
const KV = [
  { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'role', displayName: 'role', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'text', displayName: 'text', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'message_id', displayName: 'message_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'turn_id', displayName: 'turn_id', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
  { id: 'at', displayName: 'at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
];

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 300], parameters: { inputSource: 'passthrough' } },
  output: [{ phone: '2348010000000', name: 'Ada', message_id: 'wamid.1', type: 'text', text: 'Do you have red velvet cake?', media_id: '', test: true }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 300], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS_TABLE, returnAll: true } },
  output: [{ key: 'payments', value: 'mock' }]
});

const seenBefore = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Seen Before?',
    position: [640, 300],
    executeOnce: true, alwaysOutputData: true,
    parameters: {
      resource: 'row', operation: 'get', dataTableId: CHATS_TABLE, limit: 1,
      filters: { conditions: [{ keyName: 'message_id', condition: 'eq', keyValue: expr("{{ $('When Called').first().json.message_id || 'no-id-' + $now.toMillis() }}") }] }
    }
  },
  output: [{}]
});

const prepareTurn = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Turn', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE_TURN__
  } },
  output: [{ phone: '2348010000000', name: 'Ada', message_id: 'wamid.1', type: 'text', media_id: '', text: 'Do you have red velvet cake?', test: true, turn_id: 't-1', now: '2026-10-28T10:00:00.000+01:00', settings: {} }]
});

const readCustomer = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Customer',
    position: [1080, 300],
    alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CUSTOMERS_TABLE, limit: 1, filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr('{{ $json.phone }}') }] } }
  },
  output: [{ phone: '2348010000000', name: 'Ada', handoff_until: '', orders_count: 0 }]
});

const checkPause = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Check Pause', position: [1300, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHECK_PAUSE__
  } },
  output: [{ phone: '2348010000000', name: 'Ada', type: 'text', text: 'Do you have red velvet cake?', test: true, turn_id: 't-1', paused: false, customer: { orders_count: 0 }, settings: {} }]
});

const paused = ifElse({
  version: 2.2,
  config: {
    name: 'Person Handling It?',
    position: [1520, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.paused }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const forwardText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Forward Text', position: [1740, 80], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__FORWARD_TEXT__
  } },
  output: [{ chat_id: '42', text: 'Ada (+2348010000000), bot paused: hello?' }]
});

const ownerSet = ifElse({
  version: 2.2,
  config: {
    name: 'Owner Chat Set?',
    position: [1960, 80],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.chat_id }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const forwardToOwner = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Forward To Owner',
    position: [2180, 20],
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML' } },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const savePaused = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Message (paused)',
    position: [2400, 80],
    parameters: {
      resource: 'row', operation: 'insert', dataTableId: CHATS_TABLE,
      columns: { mappingMode: 'defineBelow', value: { phone: expr("{{ $('Check Pause').first().json.phone }}"), role: 'user', text: expr("{{ $('Check Pause').first().json.text }}"), message_id: expr("{{ $('Check Pause').first().json.message_id }}"), turn_id: expr("{{ $('Check Pause').first().json.turn_id }}"), at: expr("{{ $('Check Pause').first().json.now }}") }, schema: KV }
    }
  },
  output: [{ id: 1 }]
});

const pausedResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Paused Result',
    position: [2620, 80],
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 'r', name: 'reply', value: '', type: 'string' },
      { id: 'k', name: 'kind', value: 'paused (a person is handling this chat)', type: 'string' }
    ] } }
  },
  output: [{ reply: '', kind: 'paused (a person is handling this chat)' }]
});

const readReceipt = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Read Receipt',
    position: [1740, 320],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [
        { id: 'k', name: 'kind', value: 'read', type: 'string' },
        { id: 't', name: 'to', value: expr('{{ $json.phone }}'), type: 'string' },
        { id: 'm', name: 'message_id', value: expr('{{ $json.message_id }}'), type: 'string' },
        { id: 'x', name: 'test', value: expr('{{ $json.test }}'), type: 'boolean' }
      ] }
    }
  },
  output: [{ kind: 'read', to: '2348010000000', message_id: 'wamid.1', test: true }]
});

const markRead = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Blue Ticks + Typing', position: [1960, 320], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const isVoice = ifElse({
  version: 2.2,
  config: {
    name: 'Voice Note?',
    position: [2180, 320],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr("{{ $('Check Pause').first().json.type }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'audio' },
          { leftValue: expr("{{ $('Check Pause').first().json.media_id }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
          { leftValue: expr("{{ $('Check Pause').first().json.test }}"), operator: { type: 'boolean', operation: 'false', singleValue: true } }
        ],
        combinator: 'and'
      }
    }
  }
});

const mediaUrl = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Media URL',
    position: [2400, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      method: 'GET',
      url: expr("https://graph.facebook.com/{{ $('Check Pause').first().json.settings.graph_version || 'v23.0' }}/{{ $('Check Pause').first().json.media_id }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'whatsAppApi'
    },
    credentials: WHATSAPP_CRED
  },
  output: [{ url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1', mime_type: 'audio/ogg; codecs=opus' }]
});

const downloadAudio = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Voice Note',
    position: [2620, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'whatsAppApi',
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    },
    credentials: WHATSAPP_CRED
  },
  output: [{}]
});

const nameAudio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Name Audio File', position: [2840, 520], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__NAME_AUDIO_FILE__
  } },
  output: [{}]
});

const transcribe = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Transcribe Voice Note',
    position: [3060, 520],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    parameters: { resource: 'audio', operation: 'transcribe', binaryPropertyName: 'data', options: { language: 'en' } },
    credentials: OPENAI_CRED
  },
  output: [{ text: 'Abeg I wan order red velvet cake for Saturday' }]
});

const readHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read History',
    position: [3280, 320],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CHATS_TABLE, limit: 12, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr("{{ $('Check Pause').first().json.phone }}") }] } }
  },
  output: [{ phone: '2348010000000', role: 'user', text: 'Hi' }]
});

const readOrders = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Orders',
    position: [200, 860],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, limit: 10, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr("{{ $('Check Pause').first().json.phone }}") }] } }
  },
  output: [{ order_id: 'HC-7K2Q', status: 'cart', items_json: '[]' }]
});

const buildInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Agent Input', position: [420, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_AGENT_INPUT__
  } },
  output: [{ phone: '2348010000000', name: 'Ada', turn_id: 't-1', test: true, text: 'Do you have red velvet cake?', voice: false, prompt: 'Customer: Ada ...' }]
});

const model = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 mini',
    position: [560, 1100],
    parameters: { model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' }, options: { reasoningEffort: 'low', maxRetries: 2, timeout: 60000 } },
    credentials: OPENAI_CRED
  }
});

const searchMenuTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'search_menu',
    position: [700, 1100],
    parameters: {
      description: 'Search the Honeycrumb menu: products, SKUs, prices, sizes (serves), lead times, allergens and whether something is sold out today. Leave both fields empty for an overview of categories.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'search_menu', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST), customer_name: expr(NAME),
          query: fromAi('query', 'Words to look for, e.g. "red velvet", "chocolate", "nut free", "party"', 'string'),
          category: fromAi('category', 'cakes, cupcakes, pastries, small chops, drinks, or empty for all', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const cartTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'update_cart',
    position: [840, 1100],
    parameters: {
      description: 'Change or show the customer\'s cart. op: add (adds qty), set (sets the quantity, 0 removes), remove, clear, or view. Returns the cart with prices and subtotal, calculated by the shop.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'update_cart', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST), customer_name: expr(NAME),
          op: fromAi('op', 'add, set, remove, clear or view', 'string'),
          sku: fromAi('sku', 'Product SKU from search_menu, e.g. CK-RV8 (empty for clear or view)', 'string'),
          qty: fromAi('qty', 'Quantity for add or set (default 1)', 'number'),
          cake_message: fromAi('cake_message', 'Message to write on a cake, up to 30 characters, or empty', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const deliveryTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'delivery_quote',
    position: [980, 1100],
    parameters: {
      description: 'Delivery fee and usual delivery time for a Lagos area or address (e.g. "VI", "Ajah", "Ikeja GRA"). Says if we don\'t cover it.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'delivery_quote', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST), customer_name: expr(NAME),
          area: fromAi('area', 'The area or address the customer gave', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const checkoutTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'checkout',
    position: [1120, 1100],
    parameters: {
      description: 'Place the order once the customer has confirmed the summary. Checks everything (name, delivery or pickup, area and address, date, window, lead times) and creates the Paystack payment link, which is sent as a Pay button automatically. If something is missing or too soon it says what.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'checkout', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST),
          customer_name: fromAi('customer_name', 'Name for the order', 'string'),
          fulfilment: fromAi('fulfilment', 'delivery or pickup', 'string'),
          area: fromAi('area', 'Delivery area (empty for pickup)', 'string'),
          address: fromAi('address', 'Full delivery address with a landmark (empty for pickup)', 'string'),
          deliver_on: fromAi('deliver_on', 'Date as YYYY-MM-DD', 'string'),
          window: fromAi('window', 'Delivery: 10am-1pm, 1pm-4pm or 4pm-6pm. Pickup: 9am-12pm, 12pm-3pm or 3pm-7pm', 'string'),
          note: fromAi('note', 'Anything else for the kitchen or rider, or empty', 'string'),
          email: fromAi('email', 'Customer email for the Paystack receipt if they gave one, else empty', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const statusTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'order_status',
    position: [1260, 1100],
    parameters: {
      description: 'The customer\'s recent orders and their status (waiting for payment, paid, baking, out for delivery, ready for pickup, delivered).',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { action: 'order_status', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST), customer_name: expr(NAME) },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const humanTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'request_human',
    position: [1400, 1100],
    parameters: {
      description: 'Hand the chat to a person at Honeycrumb: complaints, refunds, wrong or damaged orders, custom designs, allergy guarantees, corporate orders, or when the customer asks for a person. The assistant then stays quiet in this chat for 2 hours.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'request_human', phone: expr(PHONE), turn_id: expr(TURN), test: expr(TEST), customer_name: expr(NAME),
          reason: fromAi('reason', 'One sentence: what the customer needs a person for', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Shop Agent',
    position: [700, 860],
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.prompt }}'),
      options: {
        systemMessage:
__PROMPT_SHOP_AGENT__
        ,
        maxIterations: 8,
        enableStreaming: false
      }
    },
    subnodes: { model: model, tools: [searchMenuTool, cartTool, deliveryTool, checkoutTool, statusTool, humanTool] }
  },
  output: [{ output: 'Yes! We have red velvet in 6-inch (₦38,000) and 8-inch (₦55,000).' }]
});

const findPayment = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Payment Link This Turn?',
    position: [1100, 860],
    executeOnce: true, alwaysOutputData: true,
    parameters: {
      resource: 'row', operation: 'get', dataTableId: ORDERS_TABLE, limit: 1, matchType: 'allConditions',
      filters: { conditions: [
        { keyName: 'turn_id', condition: 'eq', keyValue: expr("{{ $('Build Agent Input').first().json.turn_id }}") },
        { keyName: 'status', condition: 'eq', keyValue: 'awaiting_payment' }
      ] }
    }
  },
  output: [{}]
});

const composeReply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compose Reply', position: [1320, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COMPOSE_REPLY__
  } },
  output: [{ to: '2348010000000', kind: 'text', body: 'Yes! We have red velvet.', url: '', button_text: '', test: true, chats: [] }]
});

const sendReply = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Reply', position: [1540, 860], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const chatRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Chat Rows', position: [1760, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CHAT_ROWS__
  } },
  output: [{ phone: '2348010000000', role: 'user', text: 'Hi', message_id: 'wamid.1', turn_id: 't-1', at: '2026-10-28T10:00:00.000+01:00' }]
});

const saveChats = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Chats',
    position: [1980, 860],
    parameters: {
      resource: 'row', operation: 'insert', dataTableId: CHATS_TABLE,
      columns: { mappingMode: 'defineBelow', value: { phone: expr('{{ $json.phone }}'), role: expr('{{ $json.role }}'), text: expr('{{ $json.text }}'), message_id: expr('{{ $json.message_id }}'), turn_id: expr('{{ $json.turn_id }}'), at: expr('{{ $json.at }}') }, schema: KV }
    }
  },
  output: [{ id: 1 }]
});

const saveCustomer = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Customer',
    position: [2200, 860],
    executeOnce: true,
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: CUSTOMERS_TABLE,
      filters: { conditions: [{ keyName: 'phone', condition: 'eq', keyValue: expr("{{ $('Build Agent Input').first().json.phone }}") }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { phone: expr("{{ $('Build Agent Input').first().json.phone }}"), name: expr("{{ $('Build Agent Input').first().json.name }}"), last_inbound_at: expr("{{ $('Build Agent Input').first().json.now }}") },
        schema: [
          { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
          { id: 'last_inbound_at', displayName: 'last_inbound_at', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
        ]
      }
    }
  },
  output: [{ phone: '2348010000000' }]
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [2420, 860], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ reply: 'Yes! We have red velvet.', kind: 'text', url: '', button_text: '' }]
});

const note = sticky(
  '## Honeycrumb 2: Handle Message\nOne customer message, from **Honeycrumb 1** (or a test run with `test = true`).\n1. Duplicate WhatsApp deliveries are dropped. If a person took over the chat (`request_human`), the message is forwarded to the owner and the bot stays quiet.\n2. Blue ticks and the typing indicator go out at once. Voice notes are downloaded and transcribed with Whisper.\n3. The agent gets one prompt: customer, time in Lagos, open cart, recent orders, the last 12 messages and the new one (no memory node: one data-table read).\n4. GPT-5.4 mini answers with the six shop tools. If this turn created a payment link, the reply goes out with a **Pay ₦X** button.\n5. Both messages are saved to **Honeycrumb Chats**.',
  [], { position: [160, -40], width: 1300, height: 260, color: 5 }
);

export default workflow('honeycrumb-handle-message', 'Honeycrumb 2: Handle Message')
  .add(whenCalled)
  .to(readSettings)
  .to(seenBefore)
  .to(prepareTurn)
  .to(readCustomer)
  .to(checkPause)
  .to(paused
    .onTrue(forwardText.to(ownerSet.onTrue(forwardToOwner.to(savePaused)).onFalse(savePaused)))
    .onFalse(readReceipt.to(markRead).to(isVoice
      .onTrue(mediaUrl.to(downloadAudio).to(nameAudio).to(transcribe).to(readHistory))
      .onFalse(readHistory))))
  .add(readHistory)
  .to(readOrders)
  .to(buildInput)
  .to(agent)
  .to(findPayment)
  .to(composeReply)
  .to(sendReply)
  .to(chatRows)
  .to(saveChats)
  .to(saveCustomer)
  .to(result)
  .add(savePaused)
  .to(pausedResult)
  .add(agent.onError(findPayment))
  .add(note);
