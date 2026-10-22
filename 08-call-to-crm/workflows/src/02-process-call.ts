import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'IFuurjqqfST0GLCi', cachedResultName: 'Tidewater Settings' };
const CALLS = { __rl: true, mode: 'id', value: '0hHsTxLEuk6Su6C7', cachedResultName: 'Tidewater Calls' };
const CRM_WF = { __rl: true, mode: 'id', value: 'tdwCrmAdapter003', cachedResultName: 'Tidewater 3: CRM' };
const SEND_WF = { __rl: true, mode: 'id', value: 'tdwSendEmail0005', cachedResultName: 'Tidewater 5: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ call_id: 'CL-ABCDE', deal_id: 'D-1001', rep: 'Maya Collins', notes: '' }]
});

const keepAudio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Keep Audio', position: [420, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__KEEP_AUDIO__
  } },
  output: [{ call_id: 'CL-ABCDE', deal_id: 'D-1001', filename: 'call.mp3', bytes: 2000000, started_ms: 0 }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [640, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const dealRequest = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Deal Request',
    position: [860, 400],
    executeOnce: true,
    parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [
      { id: 'a', name: 'action', value: 'get_deal', type: 'string' },
      { id: 'd', name: 'deal_id', value: expr("{{ $('Keep Audio').first().json.deal_id }}"), type: 'string' }
    ] } }
  },
  output: [{ action: 'get_deal', deal_id: 'D-1001' }]
});

const getDeal = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Get Deal', position: [1080, 400], parameters: { source: 'database', workflowId: CRM_WF, mode: 'once', options: { waitForSubWorkflow: true } } },
  output: [{ found: true, deal: { deal_id: 'D-1001', stage: 'appointmentscheduled' }, contacts: [] }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare', position: [1300, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE__
  } },
  output: [{ call_id: 'CL-ABCDE', deal_id: 'D-1001', call_date: '2026-10-21' }]
});

const transcribe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Transcribe',
    position: [1520, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'multipart-form-data',
      bodyParameters: { parameters: [
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
        { parameterType: 'formData', name: 'model', value: 'gpt-4o-transcribe' },
        { parameterType: 'formData', name: 'response_format', value: 'json' },
        { parameterType: 'formData', name: 'prompt', value: expr('{{ $json.vocab }}') }
      ] },
      options: { timeout: 300000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ text: 'Hi Renee, thanks for making time today.' }]
});

const splitInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Split Input', position: [1740, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SPLIT_INPUT__
  } },
  output: [{ text: 'Hi Renee', prompt: 'People who may be on the call: ...' }]
});

const splitSpeakers = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Split Speakers',
    position: [1960, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_SPEAKER_SPLIT__
        ,
        maxTokens: 12000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'speaker_turns', strict: true, schema:
__JSON_SPEAKER_TURNS__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { turns: [] } }] }] }]
});

const transcript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Transcript', position: [2400, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TRANSCRIPT__
  } },
  output: [{ segments: [], diarised: true, transcript: '[0:00] A: Hi', duration_s: 150, prompt: 'Call date: ...' }]
});

const analyse = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Analyse Call',
    position: [2620, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_CALL_ANALYST__
        ,
        maxTokens: 8000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'call_analysis', strict: true, schema:
__JSON_CALL_ANALYSIS__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { summary: 'Discovery call' } }] }] }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Decide', position: [2840, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DECIDE__
  } },
  output: [{ call_id: 'CL-ABCDE', applied: [], pending: [], tasks: [] }]
});

const ops = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'CRM Updates', position: [3060, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CRM_OPS__
  } },
  output: [{ action: 'add_note', deal_id: 'D-1001', title: 'Call', body: 'Summary' }]
});

const applyOps = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Update CRM', position: [3280, 400], parameters: { source: 'database', workflowId: CRM_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const callRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Call Row', position: [3500, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__CALL_ROW__
  } },
  output: [{ call_id: 'CL-ABCDE', token: 't', process_ms: 40000 }]
});

const saveCall = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Call', position: [3720, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: CALLS, columns: { mappingMode: 'defineBelow', value: {
__MAP_CALLS__
  }, schema: [
__SCHEMA_CALLS__
  ] } } },
  output: [{ id: 1 }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Tell the Rep', position: [3940, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'maya@example.com', subject: 'Call processed', html: '<p>Done</p>', kind: 'review_ready', call_id: 'CL-ABCDE' }]
});

const send = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Email', position: [4160, 400], onError: 'continueRegularOutput', alwaysOutputData: true, parameters: { source: 'database', workflowId: SEND_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [4380, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ call_id: 'CL-ABCDE', review_url: 'http://localhost:5678/webhook/tidewater/review', html: '<div></div>' }]
});

const note = sticky(
  '## Tidewater 2: Process Call\nOne recorded sales call for one deal.\n1. **Get Deal** reads the deal, company, contacts and recent activity from the CRM (**Tidewater 3**).\n2. **Transcribe** (OpenAI `gpt-4o-transcribe`), then **Split Speakers** (GPT-5.4 mini) marks who said what, word for word. Code checks the split covers the transcript (else the plain text is used) and counts talk time in words.\n3. **Analyse Call**: GPT-5.4 returns strict JSON: summary, BANT, objections, competitors, next steps, a stage recommendation and a follow-up email draft.\n4. **Decide** (code): every quote is checked against the transcript. Notes and our tasks go in straight away; a one-step stage move with a real quote goes in; closing a deal, big amount changes, unverified quotes and the email wait for the rep.\n5. The call is saved and the rep gets a link to the review page.',
  [], { position: [160, -60], width: 1500, height: 280, color: 5 }
);

export default workflow('tidewater-process-call', 'Tidewater 2: Process Call')
  .add(whenCalled)
  .to(keepAudio)
  .to(readSettings)
  .to(dealRequest)
  .to(getDeal)
  .to(prepare)
  .to(transcribe)
  .to(splitInput)
  .to(splitSpeakers)
  .to(transcript)
  .to(analyse)
  .to(decide)
  .to(ops)
  .to(applyOps)
  .to(callRow)
  .to(saveCall)
  .to(emails)
  .to(send)
  .to(result)
  .add(note);
