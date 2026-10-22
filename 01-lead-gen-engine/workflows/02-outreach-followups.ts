import { workflow, node, trigger, sticky, ifElse, splitInBatches, nextBatch, languageModel, outputParser, expr, newCredential } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k' };
const SHEET_TAB = { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Leads' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };
const OPENAI_CRED = { openAiApi: newCredential('OpenAI account') };

const LEAD_SAMPLE = {
  row_number: 2,
  place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
  business_name: 'Headingley Dental Care',
  category: 'Dental clinic',
  address: '12 Otley Rd, Leeds LS6 2AD, UK',
  city: 'Leeds',
  phone: '+44 113 123 4567',
  website: 'https://headingleydental.example',
  email: 'hello@headingleydental.example',
  rating: 4.8,
  reviews: 214,
  maps_url: 'https://www.google.com/maps/place/?q=place_id:ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
  lead_score: 8,
  score_reason: 'Busy clinic that takes bookings and has a website and email.',
  personal_line: 'A 4.8 rating from 214 reviews is rare for a Leeds dental clinic.',
  status: 'new',
  emails_sent: 0,
  last_email_at: '',
  next_followup_at: '',
  thread_id: '',
  last_message_id: '',
  reply_type: '',
  reply_summary: '',
  replied_at: '',
  added_at: '2026-10-01T12:05:00.000+01:00'
};

const PICKED_SAMPLE = {
  row_number: 2,
  place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
  business_name: 'Headingley Dental Care',
  category: 'Dental clinic',
  city: 'Leeds',
  website: 'https://headingleydental.example',
  email: 'hello@headingleydental.example',
  rating: 4.8,
  reviews: 214,
  lead_score: 8,
  personal_line: 'A 4.8 rating from 214 reviews is rare for a Leeds dental clinic.',
  status: 'new',
  emails_sent: 0,
  last_message_id: '',
  step: 1,
  send_to: 'oladelesamuel56@gmail.com',
  is_test: true,
  status_after_send: 'contacted',
  next_followup_at_after_send: '2026-10-04T12:00:00.000+01:00'
};

const hourlyTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Weekdays, Hourly 9:00-17:00',
    position: [240, 300],
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '0 0 9-17 * * 1-5' }] }
    }
  },
  output: [{ timestamp: '2026-10-01T09:00:00.000+01:00' }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cfg-test', name: 'TEST_MODE', value: true, type: 'boolean' },
          { id: 'cfg-inbox', name: 'TEST_INBOX', value: 'oladelesamuel56@gmail.com', type: 'string' },
          { id: 'cfg-sender', name: 'SENDER_NAME', value: 'Samuel', type: 'string' },
          { id: 'cfg-offer', name: 'OFFER', value: "I build AI automations for small businesses: instant replies to new enquiries, automatic follow-ups so leads don't go cold, appointment booking, and AI assistants that answer common customer questions around the clock. Built on n8n and usually live within two weeks.", type: 'string' },
          { id: 'cfg-min-score', name: 'MIN_SCORE', value: 6, type: 'number' },
          { id: 'cfg-cap', name: 'DAILY_SEND_CAP', value: 20, type: 'number' },
          { id: 'cfg-per-run', name: 'MAX_PER_RUN', value: 3, type: 'number' },
          { id: 'cfg-days', name: 'FOLLOWUP_DAYS', value: expr('{{ [3, 7] }}'), type: 'array' }
        ]
      }
    }
  },
  output: [{
    TEST_MODE: true,
    TEST_INBOX: 'oladelesamuel56@gmail.com',
    SENDER_NAME: 'Samuel',
    OFFER: 'I build AI automations for small businesses.',
    MIN_SCORE: 6,
    DAILY_SEND_CAP: 20,
    MAX_PER_RUN: 3,
    FOLLOWUP_DAYS: [3, 7]
  }]
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
  output: [LEAD_SAMPLE]
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick Leads Due Now',
    position: [900, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Who gets an email this run: due follow-ups first, then the best new leads, within the daily cap.\n' +
        'const cfg = $("Config").first().json;\n' +
        'const days = cfg.FOLLOWUP_DAYS;\n' +
        'const maxEmails = days.length + 1;\n' +
        'const now = DateTime.now();\n' +
        'const isEmail = e => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(e ?? "").trim());\n' +
        'const rows = $input.all().map(i => i.json).filter(r => r.place_id);\n' +
        '\n' +
        'const sentToday = rows.filter(r => r.last_email_at && DateTime.fromISO(String(r.last_email_at)).hasSame(now, "day")).length;\n' +
        'const budget = Math.max(0, Math.min(cfg.MAX_PER_RUN, cfg.DAILY_SEND_CAP - sentToday));\n' +
        'if (budget === 0) return [];\n' +
        '\n' +
        'const followUps = rows\n' +
        '  .filter(r => r.status === "contacted" && r.last_message_id && Number(r.emails_sent) < maxEmails\n' +
        '    && r.next_followup_at && DateTime.fromISO(String(r.next_followup_at)) <= now)\n' +
        '  .sort((a, b) => String(a.next_followup_at).localeCompare(String(b.next_followup_at)));\n' +
        '\n' +
        '// Never start a second sequence with an address that is already in one.\n' +
        'const usedEmails = new Set(rows.filter(r => !["new", "no_email"].includes(r.status)).map(r => String(r.email).toLowerCase().trim()));\n' +
        'const firstEmails = [];\n' +
        'const candidates = rows\n' +
        '  .filter(r => r.status === "new" && isEmail(r.email) && Number(r.lead_score) >= cfg.MIN_SCORE)\n' +
        '  .sort((a, b) => Number(b.lead_score) - Number(a.lead_score));\n' +
        'for (const r of candidates) {\n' +
        '  const email = String(r.email).toLowerCase().trim();\n' +
        '  if (usedEmails.has(email)) continue;\n' +
        '  usedEmails.add(email);\n' +
        '  firstEmails.push(r);\n' +
        '}\n' +
        '\n' +
        'return [...followUps, ...firstEmails].slice(0, budget).map(r => {\n' +
        '  const step = Number(r.emails_sent || 0) + 1;\n' +
        '  // FOLLOWUP_DAYS counts days after the first email, so [3, 7] sends on day 0, day 3 and day 7.\n' +
        '  const gap = step <= days.length ? days[step - 1] - (step > 1 ? days[step - 2] : 0) : null;\n' +
        '  return {\n' +
        '    json: {\n' +
        '      ...r,\n' +
        '      step,\n' +
        '      send_to: cfg.TEST_MODE ? cfg.TEST_INBOX : String(r.email).trim(),\n' +
        '      is_test: cfg.TEST_MODE === true,\n' +
        '      status_after_send: gap === null ? "finished" : "contacted",\n' +
        '      next_followup_at_after_send: gap === null ? "" : now.plus({ days: gap }).toISO(),\n' +
        '    },\n' +
        '  };\n' +
        '});'
    }
  },
  output: [PICKED_SAMPLE]
});

const leadLoop = splitInBatches({
  version: 3,
  config: {
    name: 'Loop Over Leads',
    position: [1120, 300],
    parameters: { batchSize: 1, options: {} }
  }
});

const writerModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI GPT-5.4',
    position: [1300, 560],
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5.4', cachedResultName: 'gpt-5.4' },
      responsesApiEnabled: true,
      options: { reasoningEffort: 'low' }
    },
    credentials: OPENAI_CRED
  }
});

const emailParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Email Format',
    position: [1480, 560],
    parameters: {
      schemaType: 'manual',
      inputSchema: '{\n  "type": "object",\n  "properties": {\n    "subject": { "type": "string", "description": "Subject line, at most 6 words" },\n    "body": { "type": "string", "description": "Plain-text email body without sign-off or unsubscribe line" }\n  },\n  "required": ["subject", "body"]\n}'
    }
  }
});

const writeEmail = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Write Email with AI',
    position: [1380, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      promptType: 'define',
      text: expr(
        'Write email {{ $json.step }} of {{ $("Config").first().json.FOLLOWUP_DAYS.length + 1 }} in the sequence.\n\n' +
        'Business: {{ $json.business_name }}\n' +
        'Category: {{ $json.category || "unknown" }}\n' +
        'Area: {{ $json.city || "unknown" }}\n' +
        'Google rating: {{ $json.rating || "none" }} from {{ $json.reviews || 0 }} reviews\n' +
        'Website: {{ $json.website || "none" }}\n' +
        'Opening line idea: {{ $json.personal_line || "none" }}\n\n' +
        'What I offer: {{ $("Config").first().json.OFFER }}\n' +
        'My first name: {{ $("Config").first().json.SENDER_NAME }}'
      ),
      hasOutputParser: true,
      messages: {
        messageValues: [
          {
            type: 'SystemMessagePromptTemplate',
            message:
              'You write short, plain-text cold emails for a freelancer who builds AI automations for small businesses. Each email must read as if a real person wrote it to this one business.\n\n' +
              'Rules for every email: under 120 words; plain text with no markdown, links or emojis; no exclamation marks; no buzzwords such as leverage, revolutionise, game-changer or cutting-edge; never invent facts about the business; never point out a weakness such as a low rating or few reviews; no sign-off, signature or unsubscribe line, because those are added automatically.\n\n' +
              'Email 1 (intro): greet the team, open with the opening line idea in your own words (skip it if it mentions a weakness), connect it to one specific problem the offer solves for this kind of business, and ask for a 15-minute call. The subject has at most 6 words and must not look like marketing.\n' +
              'Email 2 (bump): 2 or 3 sentences following up on the first email. Add one new, concrete example of an automation this business could use, and ask whether a short call is worth it.\n' +
              'Email 3 (break-up): 2 or 3 polite sentences saying this is the last email, leaving the door open if the timing changes.\n\n' +
              'Emails 2 and 3 are sent as replies in the same thread, so their subject is not used, but still return one.'
          }
        ]
      }
    },
    subnodes: { model: writerModel, outputParser: emailParser }
  },
  output: [{ output: { subject: 'quick question about bookings', body: 'Hi Headingley Dental Care team,\n\nA 4.8 rating from 214 reviews tells me patients like you...' } }]
});

const composeEmail = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Compose Email',
    position: [1600, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'c-place', name: 'place_id', value: expr('{{ $("Loop Over Leads").item.json.place_id }}'), type: 'string' },
          { id: 'c-step', name: 'step', value: expr('{{ $("Loop Over Leads").item.json.step }}'), type: 'number' },
          { id: 'c-to', name: 'send_to', value: expr('{{ $("Loop Over Leads").item.json.send_to }}'), type: 'string' },
          { id: 'c-last', name: 'last_message_id', value: expr('{{ $("Loop Over Leads").item.json.last_message_id }}'), type: 'string' },
          { id: 'c-subject', name: 'subject', value: expr('{{ ($("Loop Over Leads").item.json.is_test ? "[TEST to " + $("Loop Over Leads").item.json.email + "] " : "") + $json.output.subject.trim() }}'), type: 'string' },
          { id: 'c-body', name: 'body', value: expr('{{ $json.output.body.trim() }}\n\n{{ $("Config").first().json.SENDER_NAME }}\n\n' + "Reply 'stop' and I won't email again."), type: 'string' },
          { id: 'c-status', name: 'status_after_send', value: expr('{{ $("Loop Over Leads").item.json.status_after_send }}'), type: 'string' },
          { id: 'c-next', name: 'next_followup_at_after_send', value: expr('{{ $("Loop Over Leads").item.json.next_followup_at_after_send }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{
    place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    step: 1,
    send_to: 'oladelesamuel56@gmail.com',
    last_message_id: '',
    subject: '[TEST to hello@headingleydental.example] quick question about bookings',
    body: 'Hi Headingley Dental Care team,\n\n...\n\nSamuel',
    status_after_send: 'contacted',
    next_followup_at_after_send: '2026-10-04T12:00:00.000+01:00'
  }]
});

const isFirstEmail = ifElse({
  version: 2.3,
  config: {
    name: 'First Email?',
    position: [1820, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.step }}'), rightValue: 1, operator: { type: 'number', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  }
});

const sendFirst = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send First Email',
    position: [2040, 200],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $json.send_to }}'),
      subject: expr('{{ $json.subject }}'),
      emailType: 'text',
      message: expr('{{ $json.body }}'),
      options: { appendAttribution: false, senderName: expr('{{ $("Config").first().json.SENDER_NAME }}') }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a2c3d4e5f60718', threadId: '19a2c3d4e5f60718', labelIds: ['SENT'] }]
});

const sendFollowUp = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Send Follow-up in Same Thread',
    position: [2040, 420],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'reply',
      messageId: expr('{{ $json.last_message_id }}'),
      emailType: 'text',
      message: expr('{{ $json.body }}'),
      options: { appendAttribution: false, senderName: expr('{{ $("Config").first().json.SENDER_NAME }}') }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: '19a2c3d4e5f60999', threadId: '19a2c3d4e5f60718', labelIds: ['SENT'] }]
});

const updateLead = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Lead After Send',
    position: [2260, 300],
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
          place_id: expr('{{ $("Compose Email").item.json.place_id }}'),
          status: expr('{{ $("Compose Email").item.json.status_after_send }}'),
          emails_sent: expr('{{ $("Compose Email").item.json.step }}'),
          last_email_at: expr('{{ $now.toISO() }}'),
          next_followup_at: expr('{{ $("Compose Email").item.json.next_followup_at_after_send }}'),
          thread_id: expr('{{ $json.threadId }}'),
          last_message_id: expr('{{ $json.id }}')
        },
        schema: [
          { id: 'place_id', displayName: 'place_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'emails_sent', displayName: 'emails_sent', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'last_email_at', displayName: 'last_email_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'next_followup_at', displayName: 'next_followup_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'thread_id', displayName: 'thread_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'last_message_id', displayName: 'last_message_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A', status: 'contacted', emails_sent: 1 }]
});

const pauseBetweenSends = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Pause 30-90s Between Sends',
    position: [2480, 300],
    parameters: {
      resume: 'timeInterval',
      amount: expr('{{ Math.floor(Math.random() * 61) + 30 }}'),
      unit: 'seconds'
    }
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A' }]
});

const overviewNote = sticky(
  '## Outreach and follow-ups\n' +
  'Runs every hour from 9:00 to 17:00, Monday to Friday (workflow timezone: Africa/Lagos; change it in workflow settings to match where your leads are).\n\n' +
  '**TEST_MODE is on.** Every email goes to `TEST_INBOX` with `[TEST to real@address]` in the subject, and the sheet is updated as if it were real. Before going live, set `TEST_MODE` to false and reset the test rows (status back to `new`, clear the outreach columns).\n\n' +
  'Other settings in **Config**: `OFFER`, `SENDER_NAME`, `MIN_SCORE`, `DAILY_SEND_CAP`, `MAX_PER_RUN`, `FOLLOWUP_DAYS`.',
  [hourlyTrigger, config],
  { color: 7 }
);

const pickNote = sticky(
  '## 1. Pick who to email\n' +
  'Follow-ups that are due go first, then new leads with an email and `lead_score >= MIN_SCORE`, best score first.\n\n' +
  'A run sends at most `MAX_PER_RUN` emails and stops for the day at `DAILY_SEND_CAP`, so sending is spread across the day. An address already in a sequence is never started again.',
  [readLeads, pickLeads],
  { color: 4 }
);

const writeNote = sticky(
  '## 2. Write and send\n' +
  'OpenAI GPT-5.4 writes each email for its step: 1 = intro using the personal opener, 2 = short bump with a new idea, 3 = polite break-up. The sign-off and the opt-out line are added by the workflow, not the AI, so they are always there.\n\n' +
  'Email 1 starts a new Gmail thread. Emails 2 and 3 are sent as replies to the last message, so the whole sequence stays in one thread.',
  [leadLoop, writeEmail, writerModel, emailParser, composeEmail, isFirstEmail, sendFirst, sendFollowUp],
  { color: 6 }
);

const recordNote = sticky(
  '## 3. Record and pace\n' +
  'Saves the Gmail thread and message IDs, counts the email, and sets the next follow-up date (`FOLLOWUP_DAYS` [3, 7] means day 3 and day 7 after the first email). After the last email the lead is marked `finished`.\n\n' +
  'A random 30-90 second pause between sends keeps the pattern human.',
  [updateLead, pauseBetweenSends],
  { color: 5 }
);

export default workflow('lead-engine-outreach', 'Lead Engine 2: Outreach and Follow-ups')
  .add(hourlyTrigger)
  .to(config)
  .to(readLeads)
  .to(pickLeads)
  .to(leadLoop
    .onEachBatch(
      writeEmail.to(composeEmail).to(isFirstEmail
        .onTrue(sendFirst.to(updateLead.to(pauseBetweenSends.to(nextBatch(leadLoop)))))
        .onFalse(sendFollowUp.to(updateLead))
      )
    )
  )
  .add(overviewNote)
  .add(pickNote)
  .add(writeNote)
  .add(recordNote);
