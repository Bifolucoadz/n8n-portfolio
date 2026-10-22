import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: '@@OPENAI_CRED_ID@@', name: 'OpenAI account' } };
const CHECK_WF = { __rl: true, mode: 'id', value: 'csrCheckPage0002', cachedResultName: 'Radar 2: Check Page' };
const SAVE_WF = { __rl: true, mode: 'id', value: 'csrSaveChange005', cachedResultName: 'Radar 5: Save Changes' };

const schedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Every 6 Hours', position: [200, 160], parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6, triggerAtMinute: 5 }] } } },
  output: [{}]
});

const runHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Run Request', position: [200, 320], parameters: { httpMethod: 'POST', path: 'radar/run', responseMode: 'lastNode', options: { allowedOrigins: '*' } } },
  output: [{ body: { key: 'k', as_of: '' } }]
});

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 480], parameters: { inputSource: 'passthrough' } },
  output: [{}]
});

const manual = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 640] },
  output: [{}]
});

const load = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Watchlist',
    position: [440, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Watchlist&ranges=%27Our%20Products%27&ranges=Matches&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const planRun = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Run', position: [660, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_RUN__
  } },
  output: [{ run_id: 'RUN-ABC123', page: { page_id: 'TS-BIKES' } }]
});

const checkEach = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Check Each Page', position: [880, 400], parameters: { source: 'database', workflowId: CHECK_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const collect = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Collect Results', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__COLLECT__
  } },
  output: [{ raw: [], prompt: '', needs_ai: true }]
});

const needsAi = ifElse({
  version: 2.2,
  config: {
    name: 'Anything to Analyse?',
    position: [1320, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.needs_ai }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const analyse = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Analyse Changes (GPT-5.4)',
    position: [1560, 240],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_ANALYST__
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'analysis', strict: true, schema:
__JSON_ANALYSIS__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [] }]
});

const planWrites = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Writes', position: [1860, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_WRITES__
  } },
  output: [{ plan: {} }]
});

const save = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save and Alert', position: [2080, 400], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Radar 1: Run Checks\nEvery 6 hours (or from the dashboard\'s **Check now**, a script, or by hand). Each active page on the **Watchlist** tab goes through **Radar 2: Check Page**. Everything that changed goes to **GPT-5.4** in one call, with the price gap to our matching bike already worked out in code. It writes a headline, why it matters and a next step, rates it 1 to 5, and matches new competitor bikes to ours. Rules in code make sure an undercut or a big price cut is never rated low. Changes, prices, matches and page states go to the sheet; anything rated 4 or 5 is emailed straight away.',
  [], { position: [160, -60], width: 1320, height: 190, color: 7 }
);

export default workflow('radar-run-checks', 'Radar 1: Run Checks')
  .add(schedule)
  .to(load)
  .add(runHook)
  .to(load)
  .add(whenCalled)
  .to(load)
  .add(manual)
  .to(load)
  .add(load)
  .to(planRun)
  .to(checkEach)
  .to(collect)
  .to(needsAi
    .onTrue(analyse.to(planWrites))
    .onFalse(planWrites))
  .add(planWrites)
  .to(save)
  .add(note);
