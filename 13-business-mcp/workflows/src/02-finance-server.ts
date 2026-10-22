import { workflow, trigger, sticky, tool, fromAi } from '@n8n/workflow-sdk';

const TOOLS_WF = { __rl: true, mode: 'id', value: 'bmsTools00000003', cachedResultName: 'Brindle 3: Tools' };
const TOOL_SCHEMA = [
  { id: 'tool', displayName: 'tool', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'server', displayName: 'server', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'query', displayName: 'query', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'client', displayName: 'client', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'project', displayName: 'project', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'person', displayName: 'person', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'assignee', displayName: 'assignee', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'task_id', displayName: 'task_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'due', displayName: 'due', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'priority', displayName: 'priority', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'hours', displayName: 'hours', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' },
  { id: 'date', displayName: 'date', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'billable', displayName: 'billable', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' },
  { id: 'week', displayName: 'week', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'team', displayName: 'team', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'due_within_days', displayName: 'due_within_days', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' },
  { id: 'month', displayName: 'month', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
  { id: 'confirm', displayName: 'confirm', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'boolean' }
];

const t_client_finances = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'client_finances',
    position: [200, 520],
    parameters: {
      description: 'Money view of one client: retainer hours and overage this month, unbilled hourly work and its value, outstanding and overdue invoices, fixed-fee projects with how much is invoiced, and billing in the last 12 months.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'client_finances',
          server: 'finance',
          client: fromAi('client', 'Client name or ID', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_invoices = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'invoices',
    position: [350, 520],
    parameters: {
      description: 'List invoices by status and client, most overdue first, with totals including VAT.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'invoices',
          server: 'finance',
          status: fromAi('status', 'unpaid (default: sent or overdue), overdue, sent, paid, draft or all', 'string', 'unpaid'),
          client: fromAi('client', 'Client name or ID; empty for all clients', 'string', '')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_profitability = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'profitability',
    position: [500, 520],
    parameters: {
      description: 'Margin on a project or on all of a client\'s projects: value (fixed fee, billable hours at rates, or retainer invoices) against the cost of time logged, margin %, effective hourly rate and budget used.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'profitability',
          server: 'finance',
          project: fromAi('project', 'Project name or ID; empty if asking about a client', 'string', ''),
          client: fromAi('client', 'Client name or ID; empty if asking about a project', 'string', '')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_draft_invoice = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'draft_invoice',
    position: [650, 520],
    parameters: {
      description: 'Prepare an invoice for a client\'s unbilled hourly time and retainer for a month. ALWAYS call with confirm=false first and show the lines to the user; only call again with confirm=true after the user agrees. confirm=true saves a draft invoice and marks that time as billed.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'draft_invoice',
          server: 'finance',
          client: fromAi('client', 'Client name or ID', 'string'),
          month: fromAi('month', 'Month to bill, YYYY-MM; empty for last month', 'string', ''),
          confirm: fromAi('confirm', 'false to preview, true to create the draft after the user agreed', 'boolean', false)
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const server = trigger({
  type: '@n8n/n8n-nodes-langchain.mcpTrigger',
  version: 2,
  config: {
    name: 'Brindle Finance',
    position: [425, 260],
    parameters: { authentication: 'bearerAuth', path: 'brindle-finance' },
    credentials: { httpBearerAuth: { id: '@@FINANCE_CRED_ID@@', name: 'Brindle MCP: finance token' } },
    subnodes: { tools: [t_client_finances, t_invoices, t_profitability, t_draft_invoice] }
  }
});

const note = sticky(
  '## Brindle 2: Finance MCP Server\nA separate server with its own token, for directors and finance only (`/mcp/brindle-finance`). Four tools: a client\'s money view, invoices and what\'s overdue, profitability of a project or client, and drafting an invoice from unbilled time (preview first, then confirm=true to save the draft). Managers connect both servers; the tools refuse finance requests that arrive through the team server.',
  [], { position: [140, -40], width: 900, height: 200, color: 7 }
);

export default workflow('brindle-finance-server', 'Brindle 2: Finance MCP Server')
  .add(server)
  .add(note);
