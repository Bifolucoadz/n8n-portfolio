import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8' };
const TICKETS_TAB = { __rl: true, mode: 'id', value: '2', cachedResultName: 'Tickets' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const TICKET_SAMPLE = {
  ok: true, problem: '', dry_run: false, ticket_ref: 'T-4K9QZ', created_at: '2026-10-01T10:40:00.000-04:00',
  session_id: 'b1f2c3d4', customer_name: 'Maria Lopez', contact: 'maria.lopez@example.com',
  reason: 'complaint', summary: 'Brake pads replaced last month are squeaking again.', urgency: 'normal'
};

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [240, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'customer_name', type: 'string' },
          { name: 'contact', type: 'string' },
          { name: 'reason', type: 'string' },
          { name: 'summary', type: 'string' },
          { name: 'urgency', type: 'string' },
          { name: 'session_id', type: 'string' },
          { name: 'dry_run', type: 'boolean' }
        ]
      }
    }
  },
  output: [{ customer_name: 'Maria Lopez', contact: 'maria.lopez@example.com', reason: 'complaint', summary: 'Brake pads replaced last month are squeaking again.', urgency: 'normal', session_id: 'b1f2c3d4', dry_run: false }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'owner-email', name: 'OWNER_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
          { id: 'shop-phone', name: 'SHOP_PHONE', value: '(617) 555-0142', type: 'string' },
          { id: 'timezone', name: 'TIMEZONE', value: 'America/New_York', type: 'string' },
          { id: 'max-handoffs', name: 'MAX_HANDOFFS_PER_SESSION', value: 3, type: 'number' }
        ]
      }
    }
  },
  output: [{ customer_name: 'Maria Lopez', contact: 'maria.lopez@example.com', reason: 'complaint', summary: 'Brake pads replaced last month are squeaking again.', urgency: 'normal', session_id: 'b1f2c3d4', dry_run: false, OWNER_EMAIL: 'samuelgurru@gmail.com', SHOP_PHONE: '(617) 555-0142', TIMEZONE: 'America/New_York', MAX_HANDOFFS_PER_SESSION: 3 }]
});

const readSessionTickets = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Tickets for This Chat',
    position: [680, 300],
    alwaysOutputData: true,
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: SHEET_DOC,
      sheetName: TICKETS_TAB,
      filtersUI: { values: [{ lookupColumn: 'session_id', lookupValue: expr('{{ $json.session_id }}') }] },
      options: { returnAllMatches: 'returnAllMatches' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, ticket_ref: 'T-1AAAA', session_id: 'b1f2c3d4' }]
});

const checkRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Request',
    position: [900, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Refuse after MAX_HANDOFFS_PER_SESSION tickets in one chat, and make sure the team has a way to reach the customer.\n' +
        'const cfg = $("Config").first().json;\n' +
        'const previous = $input.all().map(i => i.json).filter(r => r.ticket_ref && r.session_id === cfg.session_id).length;\n' +
        'const clean = (v, max) => String(v ?? "").replace(/\\s+/g, " ").trim().slice(0, max);\n' +
        'const contact = clean(cfg.contact, 120);\n' +
        'const hasEmail = /[^\\s@]+@[^\\s@]+\\.[^\\s@]+/.test(contact);\n' +
        'const hasPhone = contact.replace(/\\D/g, "").length >= 10;\n' +
        'const reasons = ["asked_for_human", "complaint", "car_status", "warranty_or_billing", "change_booking", "unanswered", "other"];\n' +
        'const reason = reasons.includes(cfg.reason) ? cfg.reason : "other";\n' +
        '\n' +
        'let problem = "";\n' +
        'if (previous >= cfg.MAX_HANDOFFS_PER_SESSION) {\n' +
        '  problem = "Not passed on: this chat has already been passed to the team " + previous + " times. Ask the customer to call " + cfg.SHOP_PHONE + ".";\n' +
        '} else if (!hasEmail && !hasPhone) {\n' +
        '  problem = "Not passed on yet: ask the customer for a phone number or email address, then call handoff_to_staff again.";\n' +
        '}\n' +
        '\n' +
        'const now = DateTime.now().setZone(cfg.TIMEZONE);\n' +
        'return [{\n' +
        '  json: {\n' +
        '    ok: !problem,\n' +
        '    problem,\n' +
        '    dry_run: cfg.dry_run === true || cfg.dry_run === "true",\n' +
        '    ticket_ref: "T-" + Math.random().toString(36).slice(2, 7).toUpperCase(),\n' +
        '    created_at: now.toISO(),\n' +
        '    session_id: cfg.session_id,\n' +
        '    customer_name: clean(cfg.customer_name, 80) || "Unknown",\n' +
        '    contact,\n' +
        '    reason,\n' +
        '    summary: clean(cfg.summary, 1000),\n' +
        '    urgency: cfg.urgency === "high" ? "high" : "normal"\n' +
        '  }\n' +
        '}];\n'
    }
  },
  output: [TICKET_SAMPLE]
});

const canHandOff = ifElse({
  version: 2.3,
  config: {
    name: 'OK to Hand Off?',
    position: [1120, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const isDryRun = ifElse({
  version: 2.3,
  config: {
    name: 'Dry Run?',
    position: [1340, 200],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.dry_run }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const dryRunResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Dry Run Result',
    position: [1560, 60],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: true, type: 'boolean' },
          { id: 'ticket', name: 'ticket_ref', value: expr('DRYRUN-{{ $json.ticket_ref }}'), type: 'string' },
          { id: 'message', name: 'message', value: 'Test run: the hand-off request is valid. Nothing was sent.', type: 'string' }
        ]
      }
    }
  },
  output: [{ success: true, ticket_ref: 'DRYRUN-T-4K9QZ', message: 'Test run: the hand-off request is valid. Nothing was sent.' }]
});

const readTranscript = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Read Chat Transcript',
    position: [1560, 260],
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 2000,
    parameters: {
      operation: 'executeQuery',
      query: 'select message from n8n_chat_histories where session_id = $1 order by id asc limit 60',
      options: { queryReplacement: expr('{{ $json.session_id }}') }
    },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  },
  output: [{ message: { type: 'human', data: { content: 'Hi, my brakes are squeaking again.' } } }]
});

const formatTranscript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Transcript',
    position: [1780, 260],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Chat memory rows are LangChain messages: { type: "human" | "ai", data: { content } }.\n' +
        'const ticket = $("Check Request").first().json;\n' +
        'const lines = $input.all()\n' +
        '  .map(i => i.json.message)\n' +
        '  .filter(Boolean)\n' +
        '  .map(m => {\n' +
        '    const msg = typeof m === "string" ? JSON.parse(m) : m;\n' +
        '    const text = String(msg.data?.content ?? msg.content ?? "").trim();\n' +
        '    return text ? (msg.type === "human" ? "Customer: " : "Assistant: ") + text : null;\n' +
        '  })\n' +
        '  .filter(Boolean);\n' +
        'return [{ json: { ...ticket, transcript: lines.length ? lines.join("\\n\\n") : "(No earlier messages saved for this chat.)" } }];\n'
    }
  },
  output: [{ ok: true, problem: '', dry_run: false, ticket_ref: 'T-4K9QZ', created_at: '2026-10-01T10:40:00.000-04:00', session_id: 'b1f2c3d4', customer_name: 'Maria Lopez', contact: 'maria.lopez@example.com', reason: 'complaint', summary: 'Brake pads replaced last month are squeaking again.', urgency: 'normal', transcript: 'Customer: Hi, my brakes are squeaking again.' }]
});

const logTicket = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Log Ticket',
    position: [2000, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      documentId: SHEET_DOC,
      sheetName: TICKETS_TAB,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          ticket_ref: expr('{{ $json.ticket_ref }}'),
          created_at: expr('{{ $json.created_at }}'),
          session_id: expr('{{ $json.session_id }}'),
          customer_name: expr('{{ $json.customer_name }}'),
          contact: expr('{{ $json.contact }}'),
          reason: expr('{{ $json.reason }}'),
          summary: expr('{{ $json.summary }}'),
          urgency: expr('{{ $json.urgency }}'),
          status: 'open'
        },
        schema: [
          { id: 'ticket_ref', displayName: 'ticket_ref', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'customer_name', displayName: 'customer_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'contact', displayName: 'contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reason', displayName: 'reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'summary', displayName: 'summary', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'urgency', displayName: 'urgency', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW', useAppend: true }
    },
    credentials: SHEETS_CRED
  },
  output: [{ ticket_ref: 'T-4K9QZ', status: 'open' }]
});

const emailOwner = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email the Team',
    position: [2220, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr("{{ $('Config').item.json.OWNER_EMAIL }}"),
      subject: expr("[Copperline chat] {{ $('Format Transcript').item.json.urgency === 'high' ? 'URGENT ' : '' }}{{ $('Format Transcript').item.json.reason.replaceAll('_', ' ') }}: {{ $('Format Transcript').item.json.customer_name }}"),
      emailType: 'text',
      message: expr(
        'A chat customer needs a reply from the team.\n\n' +
        "Ticket: {{ $('Format Transcript').item.json.ticket_ref }}\n" +
        "Reason: {{ $('Format Transcript').item.json.reason.replaceAll('_', ' ') }}\n" +
        "Urgency: {{ $('Format Transcript').item.json.urgency }}\n" +
        "Name: {{ $('Format Transcript').item.json.customer_name }}\n" +
        "Contact: {{ $('Format Transcript').item.json.contact }}\n\n" +
        "Summary from the assistant:\n{{ $('Format Transcript').item.json.summary }}\n\n" +
        "Conversation so far:\n{{ $('Format Transcript').item.json.transcript }}\n\n" +
        "Chat session: {{ $('Format Transcript').item.json.session_id }}\n" +
        'The customer was told the team replies within one business day. Mark the ticket done in the Tickets tab when you have replied.\n'
      ),
      options: { appendAttribution: false, senderName: 'Copperline Chat Assistant' }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '18f0a', threadId: '18f0a', labelIds: ['SENT'] }]
});

const handoffResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Hand-off Result',
    position: [2440, 260],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: true, type: 'boolean' },
          { id: 'ticket', name: 'ticket_ref', value: expr("{{ $('Format Transcript').item.json.ticket_ref }}"), type: 'string' },
          { id: 'message', name: 'message', value: 'Passed to the team. Give the customer the ticket reference and say the team replies within one business day, sooner during opening hours.', type: 'string' }
        ]
      }
    }
  },
  output: [{ success: true, ticket_ref: 'T-4K9QZ', message: 'Passed to the team.' }]
});

const refused = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Not Handed Off',
    position: [1340, 440],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'success', name: 'success', value: false, type: 'boolean' },
          { id: 'message', name: 'message', value: expr('{{ $json.problem }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ success: false, message: 'Not passed on yet: ask the customer for a phone number or email address.' }]
});

const noteOverview = sticky(
  '## Hand Off to Staff (agent tool)\n' +
  'Called by the chat agent as `handoff_to_staff` when a customer asks for a person, complains, asks about a car already at the shop, has a warranty or billing question, wants to change a booking, or needs an answer the bot could not find.\n\n' +
  '- Needs a phone number or email, so the team can reply.\n' +
  '- At most `MAX_HANDOFFS_PER_SESSION` tickets per chat, so one chat cannot flood the inbox.\n' +
  '- Eval runs pass `dry_run = true`: the request is checked but nothing is written or sent.',
  [whenCalled, config, readSessionTickets, checkRequest, canHandOff, isDryRun, dryRunResult, refused],
  { color: 4 }
);

const noteSend = sticky(
  '## Ticket and email\n' +
  'Logs the ticket in the **Tickets** tab and emails the team the summary plus the full chat transcript from Supabase.',
  [readTranscript, formatTranscript, logTicket, emailOwner, handoffResult],
  { color: 5 }
);

export default workflow('support-bot-hand-off', 'Support Bot 5: Hand Off to Staff')
  .add(whenCalled)
  .to(config)
  .to(readSessionTickets)
  .to(checkRequest)
  .to(canHandOff
    .onTrue(isDryRun
      .onTrue(dryRunResult)
      .onFalse(readTranscript.to(formatTranscript).to(logTicket).to(emailOwner).to(handoffResult)))
    .onFalse(refused))
  .add(noteOverview)
  .add(noteSend);
