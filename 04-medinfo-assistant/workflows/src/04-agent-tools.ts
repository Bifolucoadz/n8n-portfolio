import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const called = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Agent',
    position: [200, 400],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'action', type: 'string' },
          { name: 'chunk_id', type: 'string' },
          { name: 'term', type: 'string' },
          { name: 'requester_name', type: 'string' },
          { name: 'contact', type: 'string' },
          { name: 'question', type: 'string' },
          { name: 'product', type: 'string' },
          { name: 'allowed_access', type: 'string' },
          { name: 'session_id', type: 'string' },
          { name: 'channel', type: 'string' },
          { name: 'role', type: 'string' },
          { name: 'dry_run', type: 'boolean' }
        ]
      }
    }
  },
  output: [{ action: 'read_section', chunk_id: 'c319', term: '', requester_name: '', contact: '', question: '', product: '', allowed_access: 'public', session_id: 's-1', channel: 'web', role: 'hcp', dry_run: false }]
});

const action = switchCase({
  version: 3.4,
  config: {
    name: 'Which Tool?',
    position: [420, 400],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: 'read_section',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'read_section', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'lookup_product',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'lookup_product', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'request_mi',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'request_mi', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          }
        ]
      }
    }
  }
});

const readSection = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Read Section',
    position: [700, 200],
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_read_section($1::jsonb) as result;',
      options: { queryReplacement: expr("{{ JSON.stringify({ chunk_id: $json.chunk_id, access: String($json.allowed_access || 'public').split(',') }) }}") }
    },
    credentials: PG_CRED
  },
  output: [{ result: { found: true, id: 'c319', doc_code: 'LRK-PI-QNV', section: '2 DOSAGE AND ADMINISTRATION > 2.3 Dosage in renal impairment', text: '...' } }]
});

const lookupProduct = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Look Up Catalog',
    position: [700, 400],
    parameters: {
      operation: 'executeQuery',
      query: "select jsonb_build_object('rows', kb_lookup_product($1::jsonb), 'note', 'Catalog rows: cite each row by its id, for example [p3]. An empty list means no matching product.') as result;",
      options: { queryReplacement: expr('{{ JSON.stringify({ term: $json.term }) }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { rows: [{ id: 'p10', product: 'Aurivex', strength: '250 mg/5 mL', ndc: '99107-425-10', supply_status: 'Backordered' }], note: '...' } }]
});

const checkRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Request',
    position: [700, 620],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__CHECK_REQUEST__
    }
  },
  output: [{ ok: true, payload: '{"ref":"MIR-261007-AB12"}' }]
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Ready to Log?',
    position: [920, 620],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const logRequest = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Log MI Request',
    position: [1160, 540],
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_request_mi($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ $json.payload }}') }
    },
    credentials: PG_CRED
  },
  output: [{ result: { success: true, ref: 'MIR-261007-AB12', message: 'Medical Information request logged.' } }]
});

const notLogged = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Not Logged',
    position: [1160, 720],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [{ id: 'r', name: 'result', value: expr('{{ $json.result }}'), type: 'object' }] }
    }
  },
  output: [{ result: { success: false, message: 'Not submitted. Ask for the requester\'s name.' } }]
});

const note = sticky(
  '## MedInfo 4: Agent Tools\n' +
  'One workflow behind three agent tools (the agent node fixes `action`):\n\n' +
  '- `read_section`: the whole section around a cited chunk, for long tables. Access-checked in SQL.\n' +
  '- `lookup_product`: product catalog rows by name, strength or NDC.\n' +
  '- `request_medical_information`: logs an `MIR-` case for the MI team (name, valid email or phone and the question required; 3 per chat). Dry runs log nothing.',
  [called, action, readSection, lookupProduct, checkRequest, isValid, logRequest, notLogged],
  { color: 4 }
);

export default workflow('medinfo-agent-tools', 'MedInfo 4: Agent Tools')
  .add(called)
  .to(action
    .onCase(0, readSection)
    .onCase(1, lookupProduct)
    .onCase(2, checkRequest.to(isValid.onTrue(logRequest).onFalse(notLogged))))
  .add(note);
