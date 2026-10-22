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
__PROMPT_KNOWLEDGE_GAPS__
        ,
        maxTokens: 4000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'knowledge_gaps', strict: true, schema:
__SCHEMA_KNOWLEDGE_GAPS__
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
__BUILD_REPORT__
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
