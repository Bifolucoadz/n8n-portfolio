import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Mondays 8:00 am',
    position: [200, 240],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 8 * * 1' }] } }
  },
  output: [{ timestamp: '2026-10-12T08:00:00.000-04:00' }]
});

const sendNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Report Now', position: [200, 440] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [420, 340],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'chat', name: 'REPORT_CHAT_ID', value: '', type: 'string' },
          { id: 'days', name: 'DAYS', value: 7, type: 'number' }
        ]
      }
    }
  },
  output: [{ REPORT_CHAT_ID: '', DAYS: 7 }]
});

const stats = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Weekly Numbers',
    position: [640, 340],
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_weekly_stats($1::jsonb) as stats;',
      options: { queryReplacement: expr('{{ JSON.stringify({ days: $json.DAYS }) }}') }
    },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  },
  output: [{ stats: { questions: 42, sessions: 17, by_role: { hcp: 30 }, by_route: { answered: 31 }, thumbs_up: 9, thumbs_down: 2, gap_questions: [{ question: 'Does grapefruit interact with Quenvara?' }] } }]
});

const anyGaps = ifElse({
  version: 2.3,
  config: {
    name: 'Any Gaps?',
    position: [860, 340],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ ($json.stats.gap_questions ?? []).length }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and'
      }
    }
  }
});

const groupGaps = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Group Knowledge Gaps',
    position: [1080, 260],
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ JSON.stringify($json.stats.gap_questions) }}') }] },
      options: {
        instructions:
        'You help the Medical Information team of Larkmoor Therapeutics (a fictional company) improve their approved documents. You get last week\'s questions that the assistant could not answer from the documents, or that users rated thumbs down, with any user comments.\n' +
        '\n' +
        'Group them into themes (at most 8). For each theme give: a short title, how many questions belong to it, up to 3 example questions in the users\' words, the document that should cover it (an existing document number such as LRK-PI-QNV, SOP-PV-001 or LRK-SRL-LUM-001 if one fits, otherwise "new standard response letter" or "new FAQ"), and one sentence on what to add. Leave out personal details such as names, emails and phone numbers. Ignore off-topic or abusive messages.\n'
        ,
        maxTokens: 4000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'knowledge_gaps', strict: true, schema:
        '{"type":"object","additionalProperties":false,"required":["themes"],"properties":{"themes":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["title","count","examples","document","suggestion"],"properties":{"title":{"type":"string"},"count":{"type":"integer"},"examples":{"type":"array","items":{"type":"string"}},"document":{"type":"string"},"suggestion":{"type":"string"}}}}}}'
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { themes: [{ title: 'Food interactions', count: 2, examples: ['Does grapefruit interact with Quenvara?'], document: 'LRK-PI-QNV', suggestion: 'Add a statement on food and grapefruit.' }] } }] }] }]
});

const buildReport = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Report',
    position: [1300, 340],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// The weekly report as Telegram HTML (and plain JSON for the execution log).\n' +
        'const s = $(\'Weekly Numbers\').first().json.stats ?? {};\n' +
        'let themes = [];\n' +
        'if ($(\'Group Knowledge Gaps\').isExecuted) {\n' +
        '  for (const o of $(\'Group Knowledge Gaps\').first().json.output ?? []) {\n' +
        '    for (const c of o.content ?? []) {\n' +
        '      let d = c.text;\n' +
        '      if (typeof d === \'string\') { try { d = JSON.parse(d); } catch (e) { d = null; } }\n' +
        '      if (d?.themes) themes = d.themes;\n' +
        '    }\n' +
        '  }\n' +
        '}\n' +
        'const esc = v => String(v ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        'const list = obj => Object.entries(obj ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k.replace(/_/g, \' \'))}: ${n}`).join(\', \') || \'none\';\n' +
        'const sec = ms => (ms ? (ms / 1000).toFixed(1) + \' s\' : \'n/a\');\n' +
        'const lines = [\n' +
        '  \'<b>Larkmoor Medical Information assistant: last 7 days</b>\',\n' +
        '  `${s.questions ?? 0} questions in ${s.sessions ?? 0} conversations`,\n' +
        '  `By role: ${list(s.by_role)}`,\n' +
        '  `Outcomes: ${list(s.by_route)}`,\n' +
        '  `Feedback: ${s.thumbs_up ?? 0} up, ${s.thumbs_down ?? 0} down`,\n' +
        '  `Speed: median ${sec(s.median_latency_ms)}, 90th percentile ${sec(s.p90_latency_ms)}`,\n' +
        '  \'\',\n' +
        '  \'<b>Cases opened</b>\',\n' +
        '  list(s.cases_opened),\n' +
        '];\n' +
        'if ((s.cases_overdue ?? []).length) {\n' +
        '  lines.push(`<b>Overdue (${s.cases_overdue.length})</b>: ` + s.cases_overdue.map(c => esc(c.ref)).join(\', \'));\n' +
        '}\n' +
        'lines.push(\'\', \'<b>Most cited documents</b>\');\n' +
        'lines.push(...((s.top_documents ?? []).map(d => `${esc(d.doc_code)} (${d.n}): ${esc(d.title)}`)), ...(s.top_documents?.length ? [] : [\'none\']));\n' +
        'lines.push(\'\', `<b>Knowledge gaps</b> (${(s.gap_questions ?? []).length} unanswered or thumbs-down questions)`);\n' +
        'if (themes.length) {\n' +
        '  for (const t of themes) {\n' +
        '    lines.push(`- <b>${esc(t.title)}</b> (${t.count}): ${esc(t.suggestion)} <i>Fix in: ${esc(t.document)}</i>`);\n' +
        '    for (const e of (t.examples ?? []).slice(0, 2)) lines.push(`    "${esc(e)}"`);\n' +
        '  }\n' +
        '} else {\n' +
        '  lines.push(\'None this week.\');\n' +
        '}\n' +
        'const chat = String($(\'Config\').first().json.REPORT_CHAT_ID || \'\').trim();\n' +
        'return [{ json: { chat_id: chat, send: !!chat, text: lines.join(\'\\n\').slice(0, 4000), stats: s, themes } }];\n'
    }
  },
  output: [{ chat_id: '', send: false, text: '<b>Larkmoor Medical Information assistant: last 7 days</b>', stats: {}, themes: [] }]
});

const shouldSend = ifElse({
  version: 2.3,
  config: {
    name: 'Chat ID Set?',
    position: [1520, 340],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.send }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const telegram = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send on Telegram',
    position: [1740, 260],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chat_id }}'),
      text: expr('{{ $json.text }}'),
      additionalFields: { parse_mode: 'HTML', appendAttribution: false, disable_web_page_preview: true }
    },
    credentials: { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } }
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## MedInfo 9: Weekly Insights\n' +
  'Mondays 8:00 am (New York), or **Send Report Now**. From the audit trail (`kb_weekly_stats`, eval runs excluded):\n\n' +
  '- questions by role and outcome, thumbs up/down, median and 90th-percentile response time\n' +
  '- adverse events, complaints and MI requests opened, and any still open past their due time\n' +
  '- the most cited documents\n' +
  '- **knowledge gaps**: unanswered and thumbs-down questions grouped by GPT-5.4 mini into themes, each with the document to fix\n\n' +
  'Sent on Telegram when `REPORT_CHAT_ID` is set in Config; otherwise the report is in the execution log.',
  [monday, sendNow, config, stats, anyGaps, groupGaps, buildReport, shouldSend, telegram],
  { color: 4 }
);

export default workflow('medinfo-weekly-insights', 'MedInfo 9: Weekly Insights')
  .add(monday)
  .to(config)
  .add(sendNow)
  .to(config)
  .to(stats)
  .to(anyGaps
    .onTrue(groupGaps.to(buildReport))
    .onFalse(buildReport))
  .add(buildReport)
  .to(shouldSend.onTrue(telegram))
  .add(note);
