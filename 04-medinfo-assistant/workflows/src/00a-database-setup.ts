import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Database Setup', position: [240, 300] },
  output: [{}]
});

const runSql = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Create Tables and Functions',
    position: [520, 300],
    parameters: {
      operation: 'executeQuery',
      query:
__SETUP_SQL__
      ,
      options: { queryBatching: 'single' }
    },
    credentials: PG_CRED
  },
  output: [{ setup_check: { tables: ['kb_cases'], functions: ['kb_search'], rls_off: [], anon_can_search: false, pgvector: '0.8.2' } }]
});

const note = sticky(
  '## MedInfo database setup\n' +
  'Runs `supabase/setup.sql` in the Supabase project: the `kb_*` tables, hybrid search and the other SQL functions. Safe to run again after editing the SQL.\n\n' +
  'The last row checks the result: every table has row level security on, and the public `anon` key cannot call `kb_search`.',
  [start, runSql],
  { color: 4 }
);

export default workflow('medinfo-database-setup', 'MedInfo 0a: Database Setup')
  .add(start)
  .to(runSql)
  .add(note);
