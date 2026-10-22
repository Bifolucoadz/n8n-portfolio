import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '@@SHEETS_CRED_ID@@', name: 'Google Sheets account' } };
const SAVE_WF = { __rl: true, mode: 'id', value: 'csrSaveChange005', cachedResultName: 'Radar 5: Save Changes' };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: { name: 'Mondays 8:00', position: [200, 240], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const manual = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Now', position: [200, 420] },
  output: [{}]
});

const loadAll = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load All',
    position: [440, 320],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/@@SHEET_ID@@/values:batchGet?ranges=Settings&ranges=Watchlist&ranges=%27Our%20Products%27&ranges=Matches&ranges=Prices&ranges=Changes&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Digest', position: [660, 320], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_DIGEST__
  } },
  output: [{ plan: {} }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Digest', position: [880, 320], parameters: { source: 'database', workflowId: SAVE_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Radar 4: Weekly Digest\nMonday 8:00 (Europe/London). One email for the team: the week\'s changes in order of importance with what to do about them, our price against the cheapest in-stock rival for every bike, and any pages the radar couldn\'t read.',
  [], { position: [160, 40], width: 880, height: 150, color: 7 }
);

export default workflow('radar-weekly-digest', 'Radar 4: Weekly Digest')
  .add(monday)
  .to(loadAll)
  .to(build)
  .to(send)
  .add(manual)
  .to(loadAll)
  .add(note);
