import { workflow, node, trigger, sticky, languageModel, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1_RHqBp7k3rWBY-4plb2oo2mIryQlHIUuNOZ-YhCpVS8' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const everyMonday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Mondays 8:00 am',
    position: [240, 240],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 8 * * 1' }] } }
  },
  output: [{ timestamp: '2026-10-05T08:00:00.000-04:00' }]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Report Now', position: [240, 440] },
  output: [{}]
});

const readConversations = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Conversations',
    position: [480, 340],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '0', cachedResultName: 'Conversations' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, timestamp: '2026-10-01T10:55:30.948-04:00', session_id: 'b1f2c3d4', user_message: 'Do you do window tinting?', bot_reply: "I'm not sure.", tools_used: 'search_shop_info, log_unanswered_question' }]
});

const readBookings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Bookings',
    position: [700, 340],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '1', cachedResultName: 'Bookings' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, booking_ref: 'CA-KCI2C', created_at: '2026-10-01T10:54:07.832-04:00', service: 'oil_change', session_id: 'b1f2c3d4', status: 'booked' }]
});

const readTickets = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Tickets',
    position: [920, 340],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '2', cachedResultName: 'Tickets' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, ticket_ref: 'T-7Z6ZS', created_at: '2026-10-01T10:54:55.000-04:00', session_id: 'b1f2c3d4', reason: 'complaint', status: 'open' }]
});

const readUnanswered = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Unanswered',
    position: [1140, 340],
    executeOnce: true,
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: { __rl: true, mode: 'id', value: '3', cachedResultName: 'Unanswered' } },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, timestamp: '2026-10-01T10:55:21.471-04:00', session_id: 'b1f2c3d4', question: 'Do you do window tinting?' }]
});

const buildStats = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Stats',
    position: [1360, 340],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Last 7 days of chat activity, leaving out automated test runs (sessions starting "eval-" or "check-").\n' +
        'const tz = "America/New_York";\n' +
        'const now = DateTime.now().setZone(tz);\n' +
        'const since = now.minus({ days: 7 });\n' +
        'const isTest = s => /^(eval|check)-/.test(String(s ?? ""));\n' +
        'const recent = (name, field) => $(name).all()\n' +
        '  .map(i => i.json)\n' +
        '  .filter(r => r[field] && DateTime.fromISO(String(r[field])) >= since && !isTest(r.session_id));\n' +
        '\n' +
        'const conversations = recent("Read Conversations", "timestamp");\n' +
        'const bookings = recent("Read Bookings", "created_at");\n' +
        'const tickets = recent("Read Tickets", "created_at");\n' +
        'const unanswered = recent("Read Unanswered", "timestamp");\n' +
        '\n' +
        'const countBy = (rows, key) => Object.entries(rows.reduce((m, r) => {\n' +
        '  const k = r[key] || "other";\n' +
        '  m[k] = (m[k] || 0) + 1;\n' +
        '  return m;\n' +
        '}, {})).sort((a, b) => b[1] - a[1]);\n' +
        'const questions = [...new Set(unanswered.map(r => String(r.question).trim()).filter(Boolean))].slice(0, 40);\n' +
        '\n' +
        'return [{\n' +
        '  json: {\n' +
        '    week_label: since.toFormat("LLL d") + " to " + now.toFormat("LLL d, yyyy"),\n' +
        '    chats: new Set(conversations.map(r => r.session_id)).size,\n' +
        '    messages: conversations.length,\n' +
        '    errors: conversations.filter(r => String(r.tools_used).startsWith("error")).length,\n' +
        '    bookings: bookings.length,\n' +
        '    bookings_by_service: countBy(bookings, "service"),\n' +
        '    handoffs: tickets.length,\n' +
        '    handoffs_by_reason: countBy(tickets, "reason"),\n' +
        '    open_tickets: tickets.filter(r => r.status === "open").length,\n' +
        '    unanswered_count: unanswered.length,\n' +
        '    questions_text: questions.length ? questions.map(q => "- " + q).join("\\n") : "(none)"\n' +
        '  }\n' +
        '}];\n'
    }
  },
  output: [{ week_label: 'Sep 24 to Oct 1, 2026', chats: 5, messages: 9, errors: 0, bookings: 1, bookings_by_service: [['oil_change', 1]], handoffs: 1, handoffs_by_reason: [['complaint', 1]], open_tickets: 1, unanswered_count: 1, questions_text: '- Do you do window tinting?' }]
});

const reportModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'GPT-5.4 mini',
    position: [1560, 560],
    parameters: {
      model: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      options: { reasoningEffort: 'low' }
    },
    credentials: { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } }
  }
});

const groupQuestions = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Group Unanswered Questions',
    position: [1580, 340],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    parameters: {
      promptType: 'define',
      text: expr(
        'Customers asked the Copperline Auto Repair chat assistant these questions this week, and its shop info could not answer them:\n' +
        '{{ $json.questions_text }}\n\n' +
        'Group them into themes. Return one line per theme in exactly this format, with no other text:\n' +
        'Theme | number of questions | one sentence the owner could paste into the shop info doc\n\n' +
        'Write the sentence as the shop ("We ..."), with any fact the owner has to fill in shown as a choice or blank in brackets, for example: We [do / do not] offer window tinting[, from $___]. Never invent prices or policies. If the list is (none), return nothing.'
      ),
      options: { systemMessage: 'You help a small auto repair shop owner keep their chat assistant\'s shop info complete. Be brief and practical.' }
    },
    subnodes: { model: reportModel }
  },
  output: [{ output: 'Window tinting | 1 | We [do / do not] offer window tinting[, from $X].' }]
});

const buildEmail = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Email',
    position: [1800, 340],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The AI returns plain "Theme | count | suggestion" lines; everything is escaped here, so customer text can\'t inject HTML.\n' +
        'const s = $("Build Stats").first().json;\n' +
        'const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
        'const row = (label, value) => "<tr><td>" + esc(label) + "</td><td><b>" + esc(value) + "</b></td></tr>";\n' +
        'const list = pairs => pairs.length\n' +
        '  ? "<ul>" + pairs.map(([k, n]) => "<li>" + esc(String(k).replaceAll("_", " ")) + ": " + n + "</li>").join("") + "</ul>"\n' +
        '  : "<p>None this week.</p>";\n' +
        '\n' +
        'const themes = String($input.first().json.output ?? "")\n' +
        '  .split("\\n")\n' +
        '  .map(line => line.split("|").map(part => part.trim()))\n' +
        '  .filter(parts => parts.length >= 3 && parts[0]);\n' +
        'const themesHtml = themes.length\n' +
        '  ? "<ul>" + themes.map(([theme, count, suggestion]) => "<li><b>" + esc(theme) + "</b> (" + esc(count) + "): " + esc(suggestion) + "</li>").join("") + "</ul>"\n' +
        '  : "<p>No unanswered questions this week.</p>";\n' +
        '\n' +
        'const html = [\n' +
        '  "<h2>Copperline chat assistant: weekly report</h2>",\n' +
        '  "<p>" + esc(s.week_label) + "</p>",\n' +
        '  "<table cellpadding=\'6\' style=\'border-collapse:collapse\'>",\n' +
        '  row("Chats", s.chats),\n' +
        '  row("Messages", s.messages),\n' +
        '  row("Bookings made", s.bookings),\n' +
        '  row("Passed to the team", s.handoffs + " (" + s.open_tickets + " still open)"),\n' +
        '  row("Questions it couldn\'t answer", s.unanswered_count),\n' +
        '  row("Errors", s.errors),\n' +
        '  "</table>",\n' +
        '  "<h3>Bookings by service</h3>",\n' +
        '  list(s.bookings_by_service),\n' +
        '  "<h3>Hand-offs by reason</h3>",\n' +
        '  list(s.handoffs_by_reason),\n' +
        '  "<h3>What to add to the shop info</h3>",\n' +
        '  themesHtml,\n' +
        '  "<p style=\'color:#666\'>Edit the shop info Google Doc and the assistant picks up the change within 5 minutes.</p>"\n' +
        '].join("\\n");\n' +
        '\n' +
        'return [{ json: { subject: "Copperline chat assistant: " + s.week_label, html } }];\n'
    }
  },
  output: [{ subject: 'Copperline chat assistant: Sep 24 to Oct 1, 2026', html: '<h2>Copperline chat assistant: weekly report</h2>' }]
});

const emailOwner = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email the Owner',
    position: [2020, 340],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: 'samuelgurru@gmail.com',
      subject: expr('{{ $json.subject }}'),
      emailType: 'html',
      message: expr('{{ $json.html }}'),
      options: { appendAttribution: false, senderName: 'Copperline Chat Assistant' }
    },
    credentials: { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } }
  },
  output: [{ id: '18f0c', threadId: '18f0c', labelIds: ['SENT'] }]
});

const noteReport = sticky(
  '## Weekly Report\n' +
  'Every Monday at 8:00 am (Boston time) the owner gets one email: chats, messages, bookings by service, hand-offs by reason, and errors for the last 7 days.\n\n' +
  'Questions the assistant could not answer are grouped into themes by GPT-5.4 mini, each with a suggested line to add to the shop info doc. The AI returns plain text and the email is built and escaped in code, so customer text cannot inject HTML.\n\n' +
  'Automated test sessions (`eval-`, `check-`) are left out.',
  [everyMonday, sendNow, readConversations, readBookings, readTickets, readUnanswered, buildStats, groupQuestions, reportModel, buildEmail, emailOwner],
  { color: 4 }
);

export default workflow('support-bot-weekly-report', 'Support Bot 6: Weekly Report')
  .add(everyMonday)
  .to(readConversations)
  .add(sendNow)
  .to(readConversations)
  .to(readBookings)
  .to(readTickets)
  .to(readUnanswered)
  .to(buildStats)
  .to(groupQuestions)
  .to(buildEmail)
  .to(emailOwner)
  .add(noteReport);
