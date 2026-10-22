import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Setup', position: [200, 300] },
  output: [{}]
});

const setup = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Build Database',
    position: [440, 300],
    parameters: { operation: 'executeQuery', query:
__SQL_SETUP__
      , options: { queryBatching: 'single', largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ members: 3079, active_members: 1272, payments: 20290, visits: 146071, classes: 4500, bookings: 65340 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [680, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUMMARY__
  } },
  output: [{ members: 3079 }]
});

const note = sticky(
  '## Ironleaf 0: Database Setup (manual, destructive)\nRebuilds the **ironleaf** schema in Postgres with 18 months of invented data for a 5-branch gym chain: members, plans, payments, gym check-ins, classes and bookings, dated relative to today. It plants a few stories for the demo (a rival gym hurting Salford Quays, a price rise, a fast-growing new branch, last week\'s Stockport dip and Didsbury payment failures).\nIt also creates **run_readonly()**: the assistant\'s SQL runs inside it as a role that can only read this schema, in a function where Postgres refuses writes, 500 rows at most.',
  [], { position: [160, 40], width: 900, height: 220, color: 3 }
);

export default workflow('ironleaf-setup', 'Ironleaf 0: Database Setup')
  .add(run)
  .to(setup)
  .to(summary)
  .add(note);
