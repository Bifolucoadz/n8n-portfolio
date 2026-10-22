import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const SCREEN_WF = { __rl: true, mode: 'id', value: 'ngtScreenApp0002', cachedResultName: 'Northgate 2: Screen Application' };
const FORM_CSS =
  ':root {\n' +
  '  --font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;\n' +
  '  --color-background: #eef3f0;\n' +
  '  --color-card-bg: #ffffff;\n' +
  '  --color-card-border: #dbe5df;\n' +
  '  --color-header: #10231a;\n' +
  '  --color-label: #344054;\n' +
  '  --color-focus-border: #0b6e4f;\n' +
  '  --color-submit-btn-bg: #0b6e4f;\n' +
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
    name: 'Application Form',
    position: [200, 300],
    parameters: {
      formTitle: 'Apply with Northgate Talent',
      formDescription: 'Pick the role, attach your CV as a PDF and answer four quick questions. A recruiter reads every application.<br><small>Northgate Talent is a demo recruitment agency; the jobs are examples.</small>',
      formFields: { values: [
        { fieldLabel: 'Job', fieldName: 'job', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Customer Success Manager · Leeds, hybrid (NG-101)' },
          { option: 'Junior Data Analyst · Remote, UK (NG-102)' },
          { option: 'Warehouse Team Leader, nights · Wakefield (NG-103)' }
        ] } },
        { fieldLabel: 'Full name', fieldName: 'name', fieldType: 'text', requiredField: true },
        { fieldLabel: 'Email', fieldName: 'email', fieldType: 'email', requiredField: true },
        { fieldLabel: 'Phone', fieldName: 'phone', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'LinkedIn profile', fieldName: 'linkedin', fieldType: 'text', placeholder: 'Optional' },
        { fieldLabel: 'CV (PDF)', fieldName: 'cv', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.pdf', requiredField: true },
        { fieldLabel: 'Do you have the right to work in the UK?', fieldName: 'right_to_work', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Yes' },
          { option: 'No, I would need visa sponsorship' }
        ] } },
        { fieldLabel: 'Notice period', fieldName: 'notice', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [
          { option: 'Available now' }, { option: '1 week' }, { option: '2 weeks' }, { option: '4 weeks' },
          { option: '1 month' }, { option: '2 months' }, { option: '3 months or more' }
        ] } },
        { fieldLabel: 'Salary expectation (£ a year)', fieldName: 'salary', fieldType: 'number', placeholder: 'Optional, e.g. 40000' },
        { fieldLabel: 'Privacy', fieldName: 'consent', fieldType: 'checkbox', requiredField: true, fieldOptions: { values: [
          { option: 'I agree to Northgate Talent keeping my application and CV for this role' }
        ] } }
      ] },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Send application', path: 'northgate-apply', customCss: FORM_CSS, ignoreBots: true, useWorkflowTimezone: true }
    }
  },
  output: [{ job: 'Customer Success Manager · Leeds, hybrid (NG-101)', name: 'Amara Okafor', email: 'amara.okafor@example.com', phone: '', linkedin: '', right_to_work: 'Yes', notice: '1 month', salary: 44000, consent: ['I agree'] }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Application', position: [440, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE_APPLICATION__
  } },
  output: [{ ok: true, errors: [], candidate_id: 'C1021-ABCD', job_id: 'NG-101', name: 'Amara Okafor', email: 'amara.okafor@example.com' }]
});

const valid = ifElse({
  version: 2.2,
  config: {
    name: 'Valid?',
    position: [680, 300],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const screen = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Screen in Background', position: [920, 200], parameters: { source: 'database', workflowId: SCREEN_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const thanks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Thank-you Page', position: [1160, 200], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__THANK_YOU__
  } },
  output: [{ html: '<h2>Thanks</h2>' }]
});

const showThanks = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Thanks', position: [1400, 200], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const problem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Problem Page', position: [920, 420], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PROBLEM_PAGE__
  } },
  output: [{ html: '<h2>Something needs fixing</h2>' }]
});

const showProblem = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: { name: 'Show Problem', position: [1160, 420], parameters: { operation: 'completion', respondWith: 'showText', responseText: expr('{{ $json.html }}') } }
});

const note = sticky(
  '## Northgate 1: Apply Form\nThe public application form (`/form/northgate-apply`): job, name, email, CV as a PDF, right to work, notice period and salary expectation.\n\n**Prepare Application** checks the answers and the file (PDF, under 5 MB), then the CV goes to **Northgate 2** in the background. The applicant sees a thank-you page straight away and never sees a score.',
  [], { position: [160, 20], width: 900, height: 200, color: 4 }
);

export default workflow('northgate-apply-form', 'Northgate 1: Apply Form')
  .add(form)
  .to(prepare)
  .to(valid
    .onTrue(screen.to(thanks).to(showThanks))
    .onFalse(problem.to(showProblem)))
  .add(note);
