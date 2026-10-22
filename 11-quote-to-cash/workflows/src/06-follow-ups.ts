import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'mgvSaveChange007', cachedResultName: 'Mossgrove 7: Save Changes' };

const daily = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Every Morning 7:30', position: [200, 240], parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 30 }] } } },
  output: [{}]
});

const manual = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Now', position: [200, 420] },
  output: [{}]
});

const loadAll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All',
    position: [440, 320],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Quotes&ranges=Events&ranges=Schedule&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan Follow-ups', position: [660, 320], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN_FOLLOW_UPS__
  } },
  output: [{ plan: {} }]
});

const save = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Save and Send', position: [880, 320], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Mossgrove 6: Daily Follow-ups\nEvery morning at 7:30 (Europe/London). Chases sent quotes after 3 and 7 days (the wording depends on whether the client opened it), expires quotes past their date, reminds clients about unpaid deposits and overdue invoices, and asks for a review two days after the final payment. Then the owner gets a summary: jobs starting this week, drafts to send, warm quotes worth a call, money coming in, and what was done for them.',
  [], { position: [160, 0], width: 900, height: 190, color: 7 }
);

export default workflow('mossgrove-follow-ups', 'Mossgrove 6: Daily Follow-ups')
  .add(daily)
  .to(loadAll)
  .to(plan)
  .to(save)
  .add(manual)
  .to(loadAll)
  .add(note);
