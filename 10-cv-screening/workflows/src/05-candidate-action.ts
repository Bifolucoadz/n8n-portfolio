import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const CAL_WF = { __rl: true, mode: 'id', value: 'ngtCalendar00009', cachedResultName: 'Northgate 9: Calendar' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ candidate_id: 'C1021-ABCD', action: 'invite', actor: 'Priya Shah' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readCandidate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read Candidate',
    position: [640, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr("{{ $('When Called').first().json.candidate_id }}") }] } }
  },
  output: [{ candidate_id: 'C1021-ABCD', status: 'new', band: 'shortlist', token: 't' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [860, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager' }]
});

const plan = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Plan', position: [1080, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PLAN__
  } },
  output: [{ route: 'invite', message: '', action: 'busy', from: '2026-10-22T00:00:00.000+01:00', to: '2026-11-12T00:00:00.000+00:00' }]
});

const which = switchCase({
  version: 3.2,
  config: {
    name: 'Decision',
    position: [1300, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'invite', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'invite' }], combinator: 'and' } },
        { outputKey: 'reject', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'reject' }], combinator: 'and' } },
        { outputKey: 'hold', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'hold' }], combinator: 'and' } }
      ] },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'refused' }
    }
  }
});

const busy = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Interviewer Busy Times', position: [1540, 200], parameters: { source: 'database', workflowId: CAL_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const invite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Invite', position: [1760, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__INVITE__
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'invited', emails: [], answer: { ok: true, message: 'Invite sent.' } }]
});

const reject = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Reject', position: [1760, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__REJECT__
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'rejected', emails: [], answer: { ok: true, message: 'Rejected.' } }]
});

const hold = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Hold', position: [1760, 600], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__HOLD__
  } },
  output: [{ candidate_id: 'C1021-ABCD', status: 'hold', emails: [], answer: { ok: true, message: 'On hold.' } }]
});

const applyChange = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Apply Change', position: [1980, 400] }
});

const update = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Update Candidate',
    position: [2200, 400],
    parameters: {
      resource: 'row', operation: 'update', dataTableId: CANDIDATES,
      filters: { conditions: [{ keyName: 'candidate_id', condition: 'eq', keyValue: expr('{{ $json.candidate_id }}') }] },
      columns: { mappingMode: 'defineBelow', value: {
__MAP_STATUS__
      }, schema: [
__SCHEMA_STATUS__
      ] }
    }
  },
  output: [{ id: 3 }]
});

const logEvent = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Log Event', position: [2420, 400], executeOnce: true, parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
    candidate_id: expr("{{ $('Apply Change').first().json.candidate_id }}"),
    event: expr("{{ $('Apply Change').first().json.event }}"),
    detail: expr("{{ $('Apply Change').first().json.detail }}"),
    actor: expr("{{ $('Apply Change').first().json.actor }}"),
    at: expr("{{ $('Apply Change').first().json.at }}")
  }, schema: [
__SCHEMA_EVENTS__
  ] } } },
  output: [{ id: 9 }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [2640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'Interview invitation', html: '<p>Hi</p>', kind: 'interview_invite', candidate_id: 'C1021-ABCD' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [2860, 400], alwaysOutputData: true, onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [3080, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ANSWER__
  } },
  output: [{ ok: true, message: 'Invite sent with 5 times to choose from.' }]
});

const note = sticky(
  '## Northgate 5: Candidate Action\nCarries out a recruiter\'s decision from the dashboard. **Plan** refuses anything that doesn\'t fit the candidate\'s state (e.g. inviting a knockout or rejecting twice).\n- **Invite**: reads the interviewer\'s busy times (**Northgate 9**), offers up to 5 free times on different working days and emails private booking links.\n- **Reject**: a fixed, polite email (never AI-written, no score).\n- **Hold**: no contact.\nEvery decision is logged in **Northgate Events**.',
  [], { position: [160, -60], width: 1300, height: 220, color: 5 }
);

export default workflow('northgate-candidate-action', 'Northgate 5: Candidate Action')
  .add(whenCalled)
  .to(readSettings)
  .to(readCandidate)
  .to(readJobs)
  .to(plan)
  .to(which
    .onCase(0, busy.to(invite).to(applyChange))
    .onCase(1, reject.to(applyChange))
    .onCase(2, hold.to(applyChange))
    .onCase(3, answer))
  .add(applyChange)
  .to(update)
  .to(logEvent)
  .to(emails)
  .to(send)
  .to(answer)
  .add(note);
