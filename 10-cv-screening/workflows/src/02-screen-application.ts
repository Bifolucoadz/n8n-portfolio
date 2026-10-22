import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SETTINGS = { __rl: true, mode: 'id', value: 'LXDSXYJhXdqQV8KO', cachedResultName: 'Northgate Settings' };
const JOBS = { __rl: true, mode: 'id', value: 'qycslNJXs6wOwRxE', cachedResultName: 'Northgate Jobs' };
const CANDIDATES = { __rl: true, mode: 'id', value: 'Gf6MbtbZDBcTRWhX', cachedResultName: 'Northgate Candidates' };
const EVENTS = { __rl: true, mode: 'id', value: 'v5LAsWSJxw2Uj4Ig', cachedResultName: 'Northgate Events' };
const FILES = { __rl: true, mode: 'id', value: 'nKofBkG4S6UPt1xd', cachedResultName: 'Northgate Files' };
const SEND_WF = { __rl: true, mode: 'id', value: 'ngtSendEmail0003', cachedResultName: 'Northgate 3: Send Email' };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', name: 'Amara Okafor', email: 'amara.okafor@example.com', right_to_work: 'Yes', notice_period: '1 month', salary_expectation: 44000, cv_filename: 'cv.pdf', applied_at: '2026-10-21T19:00:00.000+01:00' }]
});

const keepCv = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Keep CV', position: [420, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__KEEP_CV__
  } },
  output: [{ candidate_id: 'C1021-ABCD', cv_base64: 'JVBERi0=', cv_mime: 'application/pdf' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Settings', position: [640, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: SETTINGS, returnAll: true } },
  output: [{ key: 'mode', value: 'test' }]
});

const readJobs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read Jobs', position: [860, 400], executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: JOBS, returnAll: true } },
  output: [{ job_id: 'NG-101', title: 'Customer Success Manager', rubric_json: '{"must":[],"nice":[]}' }]
});

const earlier = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Earlier Applications',
    position: [1080, 400],
    executeOnce: true, alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: CANDIDATES, returnAll: true, filters: { conditions: [{ keyName: 'email', condition: 'eq', keyValue: expr("{{ $('Keep CV').first().json.email }}") }] } }
  },
  output: [{}]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare', position: [1300, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE__
  } },
  output: [{ candidate_id: 'C1021-ABCD', job_id: 'NG-101', duplicate_of: '', today: '21 October 2026', criteria_text: 'Must-have: ...' }]
});

const isDuplicate = ifElse({
  version: 2.2,
  config: {
    name: 'Applied Before?',
    position: [1520, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.duplicate_of }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
  }
});

const duplicateEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Duplicate Event', position: [1760, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DUPLICATE_EVENT__
  } },
  output: [{ candidate_id: 'C1020-WXYZ', event: 'duplicate_application', detail: 'Applied again', actor: 'system', at: '2026-10-21T19:00:00.000+01:00' }]
});

const logDuplicate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Log Duplicate', position: [1980, 200], parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
__MAP_EVENTS__
  }, schema: [
__SCHEMA_EVENTS__
  ] } } },
  output: [{ id: 1 }]
});

const readCv = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read CV',
    position: [1760, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4-mini' },
      responses: { values: [
        { type: 'file', role: 'user', fileType: 'base64', binaryPropertyName: 'data', fileName: expr('{{ $json.cv_filename }}') },
        { type: 'text', role: 'user', content: expr('Today is {{ $json.today }}. Read this CV and return the JSON.') }
      ] },
      options: {
        instructions:
__PROMPT_CV_READER__
        ,
        maxTokens: 6000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'cv_profile', strict: true, schema:
__JSON_CV_PROFILE__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { is_cv: true } }] }] }]
});

const anonymise = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Anonymise', position: [1980, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ANONYMISE__
  } },
  output: [{ can_score: true, prompt: 'Job: ...', flags: [] }]
});

const canScore = ifElse({
  version: 2.2,
  config: {
    name: 'Readable CV?',
    position: [2200, 400],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.can_score }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const score = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Score Candidate',
    position: [2440, 320],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.4' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_SCREENER__
        ,
        maxTokens: 6000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'screening', strict: true, schema:
__JSON_SCREENING__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { criteria: [] } }] }] }]
});

const decide = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Decide', position: [2680, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__DECIDE__
  } },
  output: [{ candidate_id: 'C1021-ABCD', score: 82, band: 'shortlist', flags_json: '[]', screen_ms: 21000 }]
});

const saveCandidate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Candidate', position: [2900, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: CANDIDATES, columns: { mappingMode: 'defineBelow', value: {
__MAP_CANDIDATES__
  }, schema: [
__SCHEMA_CANDIDATES__
  ] } } },
  output: [{ id: 1 }]
});

const saveFile = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save CV File', position: [3120, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: FILES, columns: { mappingMode: 'defineBelow', value: {
    candidate_id: expr("{{ $('Decide').first().json.candidate_id }}"),
    filename: expr("{{ $('Keep CV').first().json.cv_filename }}"),
    mime: expr("{{ $('Keep CV').first().json.cv_mime }}"),
    base64: expr("{{ $('Keep CV').first().json.cv_base64 }}")
  }, schema: [
__SCHEMA_FILES__
  ] } } },
  output: [{ id: 1 }]
});

const screenedEvent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Screened Event', position: [3340, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SCREENED_EVENT__
  } },
  output: [{ candidate_id: 'C1021-ABCD', event: 'screened', detail: 'Score 82', actor: 'system', at: '2026-10-21T19:00:00.000+01:00' }]
});

const logScreened = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Log Screening', position: [3560, 400], parameters: { resource: 'row', operation: 'insert', dataTableId: EVENTS, columns: { mappingMode: 'defineBelow', value: {
__MAP_EVENTS__
  }, schema: [
__SCHEMA_EVENTS__
  ] } } },
  output: [{ id: 1 }]
});

const emails = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Emails', position: [3780, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__EMAILS__
  } },
  output: [{ to: 'amara.okafor@example.com', subject: 'We have received your application', html: '<p>Hi</p>', kind: 'acknowledgement', candidate_id: 'C1021-ABCD' }]
});

const sendEmails = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Send Emails', position: [4000, 400], onError: 'continueRegularOutput', parameters: { source: 'database', workflowId: SEND_WF, mode: 'each', options: { waitForSubWorkflow: true } } }
});

const result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Result', position: [4220, 400], executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RESULT__
  } },
  output: [{ candidate_id: 'C1021-ABCD', band: 'shortlist', score: 82 }]
});

const note = sticky(
  '## Northgate 2: Screen Application\nOne application from the form, with the CV as a PDF.\n1. **Read CV**: GPT-5.4 mini transcribes the PDF into strict JSON and flags hidden text aimed at the AI.\n2. **Anonymise** removes names, contact details, schools, places and dates before scoring.\n3. **Score Candidate**: GPT-5.4 rates each of the job\'s criteria (met, partial, not met, unclear) with evidence from the profile.\n4. **Decide** (code, not AI) turns the ratings into a 0-100 score and a band. Right-to-work knockouts come from the form. Hidden instructions block an automatic shortlist.\n5. The candidate, the CV and an audit event are saved; the applicant gets a confirmation and the recruiter an alert for shortlisted candidates.',
  [], { position: [160, -40], width: 1400, height: 260, color: 5 }
);

export default workflow('northgate-screen-application', 'Northgate 2: Screen Application')
  .add(whenCalled)
  .to(keepCv)
  .to(readSettings)
  .to(readJobs)
  .to(earlier)
  .to(prepare)
  .to(isDuplicate
    .onTrue(duplicateEvent.to(logDuplicate))
    .onFalse(readCv.to(anonymise).to(canScore
      .onTrue(score.to(decide))
      .onFalse(decide))))
  .add(decide)
  .to(saveCandidate)
  .to(saveFile)
  .to(screenedEvent)
  .to(logScreened)
  .to(emails)
  .to(sendEmails)
  .to(result)
  .add(note);
