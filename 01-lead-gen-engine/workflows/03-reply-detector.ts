import { workflow, node, trigger, sticky, ifElse, switchCase, languageModel, outputParser, expr, newCredential } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k' };
const SHEET_TAB = { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Leads' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };
const OPENAI_CRED = { openAiApi: newCredential('OpenAI account') };

const MATCH_SAMPLE = {
  place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
  business_name: 'Headingley Dental Care',
  lead_status: 'contacted',
  previous_replied_at: '',
  thread_id: '19a2c3d4e5f60718',
  from: 'hello@headingleydental.example',
  subject: 'Re: quick question about bookings',
  reply_text: 'Sounds interesting. What would something like this cost?',
  route: 'classify'
};

const UPDATE_SAMPLE = {
  place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
  business_name: 'Headingley Dental Care',
  thread_id: '19a2c3d4e5f60718',
  from: 'hello@headingleydental.example',
  reply_text: 'Sounds interesting. What would something like this cost?',
  status: 'replied',
  reply_type: 'interested',
  reply_summary: 'Asked about pricing.',
  replied_at: '2026-10-03T10:12:00.000+01:00'
};

const inboxTrigger = trigger({
  type: 'n8n-nodes-base.gmailTrigger',
  version: 1.4,
  config: {
    name: 'Check Inbox Every 5 Min',
    position: [240, 300],
    parameters: {
      pollTimes: { item: [{ mode: 'everyX', value: 5, unit: 'minutes' }] },
      authentication: 'oAuth2',
      event: 'messageReceived',
      simple: false,
      maxResults: 25,
      filters: { q: 'in:inbox -from:me', readStatus: 'both', includeSpamTrash: false },
      options: {}
    },
    credentials: GMAIL_CRED
  },
  output: [{
    id: '19a2c3d4e5f60aaa',
    threadId: '19a2c3d4e5f60718',
    subject: 'Re: quick question about bookings',
    text: 'Sounds interesting. What would something like this cost?\n\nOn Wed, 1 Oct 2026 at 12:00, Samuel <samuelgurru@gmail.com> wrote:\n> Hi Headingley Dental Care team,',
    from: { value: [{ address: 'hello@headingleydental.example', name: 'Headingley Dental' }], text: 'Headingley Dental <hello@headingleydental.example>' },
    date: '2026-10-03T09:12:00.000Z'
  }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cfg-notify', name: 'NOTIFY_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
          { id: 'cfg-account', name: 'SENDER_ACCOUNT', value: 'samuelgurru@gmail.com', type: 'string' },
          { id: 'cfg-sheet-url', name: 'SHEET_URL', value: 'https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit', type: 'string' }
        ]
      }
    }
  },
  output: [{ NOTIFY_EMAIL: 'samuelgurru@gmail.com', SENDER_ACCOUNT: 'samuelgurru@gmail.com', SHEET_URL: 'https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit' }]
});

const readLeads = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read All Leads',
    position: [680, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: SHEET_TAB
    },
    credentials: SHEETS_CRED
  },
  output: [{
    row_number: 2,
    place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    business_name: 'Headingley Dental Care',
    email: 'hello@headingleydental.example',
    status: 'contacted',
    thread_id: '19a2c3d4e5f60718',
    replied_at: ''
  }]
});

const matchReplies = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Match Replies to Leads',
    position: [900, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Match each new inbox message to a lead by Gmail thread, then by sender address. Anything else is ignored.\n' +
        'const leads = $input.all().map(i => i.json).filter(r => r.place_id);\n' +
        'const byThread = new Map(leads.filter(l => l.thread_id).map(l => [String(l.thread_id), l]));\n' +
        'const byEmail = new Map(leads.filter(l => l.email).map(l => [String(l.email).toLowerCase().trim(), l]));\n' +
        'const out = [];\n' +
        '\n' +
        'for (const { json: m } of $("Check Inbox Every 5 Min").all()) {\n' +
        '  const from = String(m.from?.value?.[0]?.address ?? "").toLowerCase();\n' +
        '  const subject = String(m.subject ?? "");\n' +
        '  const text = String(m.text ?? "");\n' +
        '  const isBounce = /mailer-daemon|postmaster/.test(from)\n' +
        '    || /delivery status notification|undeliverable|delivery has failed|returned mail/i.test(subject);\n' +
        '\n' +
        '  let lead = byThread.get(String(m.threadId)) ?? byEmail.get(from);\n' +
        '  if (!lead && isBounce) lead = leads.find(l => l.email && text.toLowerCase().includes(String(l.email).toLowerCase()));\n' +
        '  if (!lead) continue;\n' +
        '\n' +
        '  // Keep only the new reply, not the quoted thread under it. Braces are removed because the AI prompt treats them as variables.\n' +
        '  const reply = text\n' +
        '    .split(/\\r?\\nOn [\\s\\S]{0,200}?wrote:|\\r?\\n-+ ?Original Message ?-+|\\r?\\nFrom: /)[0]\n' +
        '    .replace(/^>.*$/gm, "")\n' +
        '    .replace(/[{}]/g, "")\n' +
        '    .trim()\n' +
        '    .slice(0, 3000);\n' +
        '  const isStop = /^\\W*(stop|unsubscribe|remove me|take me off)\\b/i.test(reply);\n' +
        '\n' +
        '  out.push({\n' +
        '    json: {\n' +
        '      place_id: lead.place_id,\n' +
        '      business_name: String(lead.business_name ?? "").replace(/[{}]/g, ""),\n' +
        '      lead_status: lead.status,\n' +
        '      previous_replied_at: lead.replied_at ?? "",\n' +
        '      thread_id: m.threadId,\n' +
        '      from,\n' +
        '      subject: subject.replace(/[{}]/g, ""),\n' +
        '      reply_text: reply,\n' +
        '      route: isBounce ? "bounce" : isStop ? "stop" : "classify",\n' +
        '    },\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        'return out;'
    }
  },
  output: [MATCH_SAMPLE]
});

const routeMessage = switchCase({
  version: 3.4,
  config: {
    name: 'Route Message',
    position: [1120, 300],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: 'Bounce',
            conditions: {
              options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'bounce', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'Asked to stop',
            conditions: {
              options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'stop', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'Needs AI',
            conditions: {
              options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'classify', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          }
        ]
      },
      options: {}
    }
  }
});

const markBounced = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mark Bounced',
    position: [1380, 80],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      include: 'selected',
      includeFields: 'place_id, business_name, thread_id, from, reply_text',
      assignments: {
        assignments: [
          { id: 'b-status', name: 'status', value: 'bounced', type: 'string' },
          { id: 'b-type', name: 'reply_type', value: 'bounced', type: 'string' },
          { id: 'b-summary', name: 'reply_summary', value: expr('{{ "Delivery failed: " + $json.subject }}'), type: 'string' },
          { id: 'b-at', name: 'replied_at', value: expr('{{ $json.previous_replied_at }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A', business_name: 'Headingley Dental Care', thread_id: '19a2c3d4e5f60718', from: 'mailer-daemon@googlemail.com', reply_text: 'Address not found', status: 'bounced', reply_type: 'bounced', reply_summary: 'Delivery failed: Delivery Status Notification (Failure)', replied_at: '' }]
});

const markUnsubscribed = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mark Unsubscribed',
    position: [1380, 280],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      include: 'selected',
      includeFields: 'place_id, business_name, thread_id, from, reply_text',
      assignments: {
        assignments: [
          { id: 'u-status', name: 'status', value: 'unsubscribed', type: 'string' },
          { id: 'u-type', name: 'reply_type', value: 'unsubscribe', type: 'string' },
          { id: 'u-summary', name: 'reply_summary', value: 'Asked not to be emailed again.', type: 'string' },
          { id: 'u-at', name: 'replied_at', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A', business_name: 'Headingley Dental Care', thread_id: '19a2c3d4e5f60718', from: 'hello@headingleydental.example', reply_text: 'STOP', status: 'unsubscribed', reply_type: 'unsubscribe', reply_summary: 'Asked not to be emailed again.', replied_at: '2026-10-03T10:12:00.000+01:00' }]
});

const classifierModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI GPT-5.4 mini',
    position: [1300, 720],
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5.4-mini', cachedResultName: 'gpt-5.4-mini' },
      responsesApiEnabled: true,
      options: { reasoningEffort: 'low' }
    },
    credentials: OPENAI_CRED
  }
});

const replyParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Reply Format',
    position: [1480, 720],
    parameters: {
      schemaType: 'manual',
      inputSchema: '{\n  "type": "object",\n  "properties": {\n    "reply_type": { "type": "string", "enum": ["interested", "not_interested", "out_of_office", "unsubscribe", "other"] },\n    "summary": { "type": "string", "description": "One short sentence on what they said" },\n    "reasoning": { "type": "string", "description": "One short sentence on why this reply_type was chosen" }\n  },\n  "required": ["reply_type", "summary", "reasoning"]\n}'
    }
  }
});

const classifyReply = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Classify Reply with AI',
    position: [1380, 500],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      promptType: 'define',
      text: expr(
        'Business: {{ $json.business_name }}\n' +
        'Subject: {{ $json.subject }}\n\n' +
        'Their reply:\n' +
        '"""\n{{ $json.reply_text }}\n"""'
      ),
      hasOutputParser: true,
      messages: {
        messageValues: [
          {
            type: 'SystemMessagePromptTemplate',
            message:
              'You sort replies to cold emails sent by a freelancer who builds AI automations for small businesses. Choose exactly one reply_type:\n' +
              '- interested: wants to talk, asks a question about the service, asks for prices or details, or suggests a time.\n' +
              '- not_interested: declines, already has a solution, or says no thanks.\n' +
              '- out_of_office: an automatic away, holiday or auto-reply message.\n' +
              '- unsubscribe: asks to stop emailing or to be removed, or is annoyed at being contacted.\n' +
              '- other: anything else, such as the wrong person, a forward to a colleague, or an unclear message.\n\n' +
              'Examples:\n' +
              '"Sounds interesting, what does it cost?" = interested\n' +
              '"We are happy with our current setup, thanks." = not_interested\n' +
              '"I am out of the office until Monday with limited access to email." = out_of_office\n' +
              '"Please remove me from your list." = unsubscribe\n' +
              '"I have passed this to our practice manager." = other\n\n' +
              'summary: one short sentence on what they said. reasoning: one short sentence on why you chose the reply_type.'
          }
        ]
      }
    },
    subnodes: { model: classifierModel, outputParser: replyParser }
  },
  output: [{ output: { reply_type: 'interested', summary: 'Asked what it would cost.', reasoning: 'A pricing question signals interest.' } }]
});

const applyClassification = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Apply Classification',
    position: [1600, 500],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'a-place', name: 'place_id', value: expr('{{ $("Match Replies to Leads").item.json.place_id }}'), type: 'string' },
          { id: 'a-name', name: 'business_name', value: expr('{{ $("Match Replies to Leads").item.json.business_name }}'), type: 'string' },
          { id: 'a-thread', name: 'thread_id', value: expr('{{ $("Match Replies to Leads").item.json.thread_id }}'), type: 'string' },
          { id: 'a-from', name: 'from', value: expr('{{ $("Match Replies to Leads").item.json.from }}'), type: 'string' },
          { id: 'a-text', name: 'reply_text', value: expr('{{ $("Match Replies to Leads").item.json.reply_text }}'), type: 'string' },
          { id: 'a-type', name: 'reply_type', value: expr('{{ $json.output?.reply_type ?? "other" }}'), type: 'string' },
          { id: 'a-summary', name: 'reply_summary', value: expr('{{ $json.output?.summary ?? "Could not classify automatically. Read the reply in Gmail." }}'), type: 'string' },
          { id: 'a-status', name: 'status', value: expr('{{ $json.output?.reply_type === "out_of_office" ? $("Match Replies to Leads").item.json.lead_status : ($json.output?.reply_type === "unsubscribe" ? "unsubscribed" : "replied") }}'), type: 'string' },
          { id: 'a-at', name: 'replied_at', value: expr('{{ $json.output?.reply_type === "out_of_office" ? $("Match Replies to Leads").item.json.previous_replied_at : $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [UPDATE_SAMPLE]
});

const updateLead = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Lead Status',
    position: [1880, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: SHEET_TAB,
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['place_id'],
        value: {
          place_id: expr('{{ $json.place_id }}'),
          status: expr('{{ $json.status }}'),
          reply_type: expr('{{ $json.reply_type }}'),
          reply_summary: expr('{{ $json.reply_summary }}'),
          replied_at: expr('{{ $json.replied_at }}')
        },
        schema: [
          { id: 'place_id', displayName: 'place_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reply_type', displayName: 'reply_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reply_summary', displayName: 'reply_summary', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'replied_at', displayName: 'replied_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A', status: 'replied', reply_type: 'interested' }]
});

const isInterested = ifElse({
  version: 2.3,
  config: {
    name: 'Interested?',
    position: [1880, 560],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.reply_type }}'), rightValue: 'interested', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  }
});

const notifyMe = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Alert Me: Interested Lead',
    position: [2100, 540],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Config").first().json.NOTIFY_EMAIL }}'),
      subject: expr('Interested reply: {{ $json.business_name }}'),
      emailType: 'text',
      message: expr(
        '{{ $json.business_name }} replied and sounds interested.\n\n' +
        'Summary: {{ $json.reply_summary }}\n' +
        'From: {{ $json.from }}\n\n' +
        'Their reply:\n{{ $json.reply_text }}\n\n' +
        'Open the thread: https://mail.google.com/mail/?authuser={{ $("Config").first().json.SENDER_ACCOUNT }}#all/{{ $json.thread_id }}\n' +
        'Lead sheet: {{ $("Config").first().json.SHEET_URL }}\n'
      ),
      options: { appendAttribution: false }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a2c3d4e5f60bbb', threadId: '19a2c3d4e5f60bbb', labelIds: ['SENT'] }]
});

const watchNote = sticky(
  '## 1. Watch the inbox\n' +
  'Checks Gmail every 5 minutes for new inbox messages not sent by me (`in:inbox -from:me`).\n\n' +
  'A message counts as a lead reply when it is in a thread the Outreach workflow started, or comes from a lead\'s address. Everything else is ignored and never reaches the AI. Bounces are found by sender (mailer-daemon) and matched by the address quoted in the bounce.',
  [inboxTrigger, config, readLeads, matchReplies],
  { color: 4 }
);

const sortNote = sticky(
  '## 2. Sort the reply\n' +
  'Bounces and replies that start with "stop" or "unsubscribe" are handled by rules, without AI.\n\n' +
  'Everything else goes to OpenAI GPT-5.4 mini, which picks `interested`, `not_interested`, `out_of_office`, `unsubscribe` or `other` and writes a one-line summary. If the AI fails, the reply is filed as `other` so the sequence still stops.',
  [routeMessage, markBounced, markUnsubscribed, classifyReply, classifierModel, replyParser, applyClassification],
  { color: 6 }
);

const updateNote = sticky(
  '## 3. Update and alert\n' +
  'Out-of-office: the status stays as it was, so follow-ups carry on. Unsubscribe: `unsubscribed`. Bounce: `bounced`. Anything else: `replied`, which ends the sequence.\n\n' +
  'Interested replies also trigger an email alert with the summary, the reply and a link to the Gmail thread.',
  [updateLead, isInterested, notifyMe],
  { color: 5 }
);

export default workflow('lead-engine-replies', 'Lead Engine 3: Reply Detector')
  .add(inboxTrigger)
  .to(config)
  .to(readLeads)
  .to(matchReplies)
  .to(routeMessage
    .onCase(0, markBounced.to(updateLead))
    .onCase(1, markUnsubscribed.to(updateLead))
    .onCase(2, classifyReply.to(applyClassification.to(updateLead)))
  )
  .add(applyClassification)
  .to(isInterested.onTrue(notifyMe))
  .add(watchNote)
  .add(sortNote)
  .add(updateNote);
