import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const chatHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Chat Request',
    position: [200, 300],
    parameters: {
      httpMethod: 'POST',
      path: 'medinfo/chat',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' }
    }
  },
  output: [{ body: { session_id: 'web-abc123', message: 'What is the Quenvara dose for AF with CrCl 20?', role: 'hcp' } }]
});

const validate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Request',
    position: [420, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__VALIDATE_REQUEST__
    }
  },
  output: [{ valid: true, errors: [], message: 'What is the Quenvara dose for AF with CrCl 20?', session_id: 'web-abc123', role: 'hcp' }]
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Valid?',
    position: [640, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.valid }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const answer = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Answer',
    position: [880, 220],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'Rxr2YwhZ721sNvQy', cachedResultName: 'MedInfo 5: Answer' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          message: expr('{{ $json.message }}'),
          session_id: expr('{{ $json.session_id }}'),
          role: expr('{{ $json.role }}'),
          channel: 'web',
          dry_run: false
        },
        schema: [
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'role', displayName: 'role', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'channel', displayName: 'channel', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'dry_run', displayName: 'dry_run', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ answer: 'For nonvalvular atrial fibrillation with CrCl 15 to 29 mL/min the dose is 2.5 mg twice daily [1].', sources: [], route: 'answered', flags: {}, case_refs: [], turn_id: 't-1', session_id: 'web-abc123', role: 'hcp', tools: [], latency_ms: 9000 }]
});

const reply = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Send Answer',
    position: [1120, 220],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.answer ? $json : { answer: "Sorry, I can\'t answer right now. Please call Larkmoor Medical Information on 1-800-555-0199. To report a side effect, call Pharmacovigilance on 1-800-555-0177.", sources: [], route: "error", flags: {}, case_refs: [] } }}'),
      options: { responseCode: 200 }
    }
  }
});

const badRequest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Request',
    position: [880, 400],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { error: $json.errors.join("; ") } }}'),
      options: { responseCode: 400 }
    }
  }
});

const feedbackHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Feedback',
    position: [200, 640],
    parameters: {
      httpMethod: 'POST',
      path: 'medinfo/feedback',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' }
    }
  },
  output: [{ body: { turn_id: 't-1', rating: 1, comment: '' } }]
});

const saveFeedback = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Save Feedback',
    position: [420, 640],
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'executeQuery',
      query: 'select coalesce(kb_feedback($1::jsonb), \'{"ok": false}\'::jsonb) as result;',
      options: { queryReplacement: expr('{{ JSON.stringify({ turn_id: String($json.body.turn_id ?? ""), rating: Number($json.body.rating) > 0 ? 1 : -1, comment: String($json.body.comment ?? "").slice(0, 1000) }) }}') }
    },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  },
  output: [{ result: { ok: true, turn_id: 't-1' } }]
});

const feedbackReply = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Confirm Feedback',
    position: [640, 640],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ $json.result ?? { ok: false } }}')
    }
  }
});

const note = sticky(
  '## MedInfo 6: Chat API\n' +
  '`POST /webhook/medinfo/chat` with `{ session_id, message, role }` returns `{ answer, sources[], route, flags, case_refs[], turn_id, latency_ms }` from **MedInfo 5: Answer**.\n\n' +
  '`POST /webhook/medinfo/feedback` with `{ turn_id, rating: 1 | -1, comment }` stores thumbs up/down on the audit row.\n\n' +
  'Empty or over-long messages get a 400. If the Answer workflow fails, the caller still gets a safe reply with the Medical Information and Pharmacovigilance phone numbers.',
  [chatHook, validate, isValid, answer, reply, badRequest, feedbackHook, saveFeedback, feedbackReply],
  { color: 4 }
);

export default workflow('medinfo-chat-api', 'MedInfo 6: Chat API')
  .add(chatHook)
  .to(validate)
  .to(isValid
    .onTrue(answer.to(reply))
    .onFalse(badRequest))
  .add(feedbackHook)
  .to(saveFeedback)
  .to(feedbackReply)
  .add(note);
