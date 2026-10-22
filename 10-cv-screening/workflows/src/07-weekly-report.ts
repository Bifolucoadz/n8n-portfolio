import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };

const monday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Mondays 8:00', position: [200, 300], parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } } },
  output: [{}]
});

const now = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Send Report Now', position: [200, 500] },
  output: [{}]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [440, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'recruiter_email', value: 'priya@example.com' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [660, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const readCands = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Candidates', position: [880, 400], executeOnce: true, alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', band: 'shortlist', status: 'new', score: 82 }]
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Report', position: [1100, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__BUILD_REPORT__
  } },
  output: [{ to: 'priya@example.com', subject: 'Hiring pipeline', html: '<p>Report</p>', kind: 'weekly_report', candidate_id: '' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Email the Recruiter', position: [1320, 400], parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const note = sticky(
  '## Northgate 7: Weekly Report\nEvery Monday at 8:00 (UK time) the recruiter gets one email: applications per role this week and in total, how they were banded, who is waiting for a decision (and for how long), interviews ahead and the average screening time. Built in code from the tables, so every number is exact.',
  [], { position: [160, 80], width: 1000, height: 180, color: 4 }
);

export default workflow('northgate-weekly-report', 'Northgate 7: Weekly Report')
  .add(monday)
  .to(readSettings)
  .to(readJobs)
  .to(readCands)
  .to(build)
  .to(send)
  .add(now)
  .to(readSettings)
  .add(note);
