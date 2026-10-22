import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const PROCESS_WF = { __rl: true, mode: 'id', value: 'tdwProcessCall02', cachedResultName: 'Tidewater 2: Process Call' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #eef2fb;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #d9e1f2;\n' +
  '  --color-header: #0f1b3d;\n' +
  '  --color-label: #344054;\n' +
  '  --color-focus-border: #1d4ed8;\n' +
  '  --color-submit-btn-bg: #1d4ed8;\n' +
  '  --color-submit-btn-text: #ffffff;\n' +
  '  --border-radius-card: 14px;\n' +
  '  --border-radius-input: 10px;\n' +
  '  --font-size-header: 24px;\n' +
  '}\n' +
  '.form-header h1 { letter-spacing: -0.3px; }\n' +
  'button[type="submit"] { font-weight: 600; }\n';

const form = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Upload Call',
    position: [200, 300],
    parameters: {
      formTitle: 'Log a sales call',
      formDescription: 'Upload the recording and pick the deal. The call is transcribed and analysed, safe updates go straight into the CRM, and you review the rest and the follow-up email.<br><small>Tidewater Software is a demo company; use the sample recordings.</small>',
      formFields: { values: [
        { fieldLabel: 'Deal', fieldName: 'deal', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Calloway Dental Group: patient reminders (D-1001)' },
          { option: 'Pemberton Freight: customer tracking portal (D-1002)' },
          { option: 'Ostara Home Care: caregiver scheduling app (D-1003)' }
        ] } },
        { fieldLabel: 'Rep', fieldName: 'rep', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: 'Maya Collins' }] } },
        { fieldLabel: 'Call recording', fieldName: 'recording', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.mp3,.m4a,.wav,.webm,.mp4,.ogg', requiredField: true },
        { fieldLabel: 'Anything to add?', fieldName: 'notes', fieldType: 'textarea', placeholder: 'Optional' }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Process call', path: 'tidewater-call', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    }
  },
  output: [{ deal: 'Calloway Dental Group: patient reminders (D-1001)', rep: 'Maya Collins', notes: '' }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Upload', position: [440, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE__
  } },
  output: [{ ok: true, errors: [], call_id: 'CL-ABCDE', deal_id: 'D-1001', rep: 'Maya Collins', notes: '' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [680, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const processCall = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Process Call', position: [920, 200], parameters: { source: 'database', workflowId: PROCESS_WF, mode: 'once', options: { waitForSubWorkflow: true } } }
});

const showResult = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Result', position: [1160, 200], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const problem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [920, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PROBLEM__
  } },
  output: [{ html: '<h2>Something needs fixing</h2>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1160, 420], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const note = sticky(
  '## Tidewater 1: Upload Call\nThe rep\'s form (`/form/tidewater-call`): pick the deal, attach the recording (MP3, M4A, WAV, WEBM or MP4, up to 25 MB). **Tidewater 2** processes it while the page waits (about a minute), then the page shows the summary, what went into the CRM and what is waiting for review, with a link to the review page.',
  [], { position: [160, 20], width: 900, height: 200, color: 4 }
);

export default workflow('tidewater-upload-call', 'Tidewater 1: Upload Call')
  .add(form)
  .to(prepare)
  .to(valid
    .onTrue(processCall.to(showResult))
    .onFalse(problem.to(showProblem)))
  .add(note);
