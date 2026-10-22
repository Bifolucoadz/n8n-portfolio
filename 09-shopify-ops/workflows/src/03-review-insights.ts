import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'QbQi6BAEGxZmzGyT', cachedResultName: 'Kettle Settings' };
const REPORTS = { __rl: true, mode: 'id', value: 'AyZ17CcwolU182Td', cachedResultName: 'Kettle Reports' };
const STORE_WF = { __rl: true, mode: 'id', value: 'ktlStoreApi00001', cachedResultName: 'Kettle 1: Store API' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ktlSendEmail0006', cachedResultName: 'Kettle 6: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Mondays 8:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const runNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'owner_email', value: 'hannah@kettleandfern.example' }]
});

const askReviews = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Reviews Request', position: [660, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
    { id: 'a', name: 'action', value: 'reviews_since', type: 'string' }, { id: 'd', name: 'days', value: 14, type: 'number' }
  ] } } },
  output: [{ action: 'reviews_since', days: 14 }]
});

const getReviews = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Reviews', position: [880, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ reviews: [] }]
});

const askProducts = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: { name: 'Products Request', position: [1100, 400], executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [{ id: 'a', name: 'action', value: 'inventory', type: 'string' }] } } },
  output: [{ action: 'inventory' }]
});

const getProducts = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Products', position: [1320, 400], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ products: [] }]
});

const untagged = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'New Reviews', position: [1540, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__UNTAGGED__
  } },
  output: [{ count: 3, prompt: 'review_id: RV-5100' }]
});

const anyNew = ifElse({
  version: 2.2,
  config: {
    name: 'Any New?',
    position: [1760, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.count }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 }], combinator: 'and' } }
  }
});

const tag = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Tag Reviews',
    position: [1980, 300],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_REVIEW_TAGGER__
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'review_tags', strict: true, schema:
__JSON_REVIEW_TAGS__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { reviews: [] } }] }] }]
});

const tagRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Tags Request', position: [2200, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TAG_REQUEST__
  } },
  output: [{ action: 'tag_reviews', tags_json: '[]' }]
});

const saveTags = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save Tags', position: [2420, 300], parameters: { source: 'database', workflowId: STORE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const stats = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Week in Numbers', position: [2640, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__STATS__
  } },
  output: [{ stats: {}, prompt: 'This week: ...' }]
});

const fixes = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Suggest Fixes',
    position: [2860, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_REVIEW_FIXES__
        ,
        maxTokens: 3000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'review_fixes', strict: true, schema:
__JSON_REVIEW_FIXES__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { headline: '', fixes: [] } }] }] }]
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Report', position: [3080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REPORT__
  } },
  output: [{ email: {}, report: {} }]
});

const saveReport = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Report', position: [3300, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: REPORTS, columns: { mappingMode: 'defineBelow', value: {
    kind: expr('{{ $json.report.kind }}'), period: expr('{{ $json.report.period }}'), summary: expr('{{ $json.report.summary }}'), data_json: expr('{{ $json.report.data_json }}'), created_at: expr('{{ $json.report.created_at }}')
  }, schema: [
__SCHEMA_REPORTS__
  ] } } },
  output: [{ id: 1 }]
});

const emailItem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Email Item', position: [3520, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '// The report email for Send Email.\nreturn [{ json: $(\'Report\').first().json.email }];\n' } },
  output: [{ to: 'hannah@kettleandfern.example', subject: 'Reviews this week', html: '<p>Report</p>', kind: 'review_report', ref: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Owner', position: [3740, 400], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Kettle 3: Review Insights\nEvery Monday at 8:00 (and on demand).\n1. **Tag Reviews**: GPT-5.4 mini tags each new review with topics from a fixed list, a sentiment and a one-line issue. Tags are saved, so each review is only tagged once.\n2. **Week in Numbers** (code): reviews and average rating vs the week before, complaints and praise per topic, the worst quotes.\n3. **Suggest Fixes**: GPT-5.4 writes a headline and three fixes, using only those numbers and quotes.\n4. The report is saved in **Kettle Reports** and emailed to the owner.',
  [], { position: [160, -20], width: 1400, height: 220, color: 5 }
);

export default workflow('kettle-review-insights', 'Kettle 3: Review Insights')
  .add(monday)
  .to(readSettings)
  .to(askReviews)
  .to(getReviews)
  .to(askProducts)
  .to(getProducts)
  .to(untagged)
  .to(anyNew
    .onTrue(tag.to(tagRequest).to(saveTags).to(stats))
    .onFalse(stats))
  .add(stats)
  .to(fixes)
  .to(report)
  .to(saveReport)
  .to(emailItem)
  .to(send)
  .add(runNow)
  .to(readSettings)
  .add(note);
