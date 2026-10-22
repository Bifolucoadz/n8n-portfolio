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

const t_search = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'search',
    position: [200, 520],
    parameters: {
      description: 'Search Brindle Studio\'s clients, projects, people and tasks by name or keyword. Use it first when you are not sure of an exact name or ID.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'search',
          server: 'team',
          query: fromAi('query', 'Words to look for, e.g. "harbour" or "booking"', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_client_overview = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'client_overview',
    position: [350, 520],
    parameters: {
      description: 'Everything about one client: account lead, projects with hours used and deadlines, open and overdue tasks, retainer hours used this month, recent work and warnings. Hours only, no money (money is on the finance server).',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'client_overview',
          server: 'team',
          client: fromAi('client', 'Client name or ID, e.g. "Brightwater Dental" or "C01"', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_project_status = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'project_status',
    position: [500, 520],
    parameters: {
      description: 'Health check for one project: hours used against budget, days to the deadline, open and overdue tasks, who worked on it in the last 14 days, and risk flags (on track, watch, at risk).',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'project_status',
          server: 'team',
          project: fromAi('project', 'Project name or ID, e.g. "Harbour & Co rebrand" or "PR-103". A client name works if they have one active project.', 'string')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_list_tasks = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'list_tasks',
    position: [650, 520],
    parameters: {
      description: 'List tasks, filtered by person, project or client, status and due date. Overdue tasks come first.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'list_tasks',
          server: 'team',
          assignee: fromAi('assignee', 'Person the tasks are assigned to, or empty for anyone', 'string', ''),
          project: fromAi('project', 'Project or client name/ID, or empty for all', 'string', ''),
          status: fromAi('status', 'open (default: todo, doing or review), overdue, todo, doing, review, done or all', 'string', 'open'),
          due_within_days: fromAi('due_within_days', 'Only tasks due within this many days; 0 for any date', 'number', 0)
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_my_week = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'my_week',
    position: [800, 520],
    parameters: {
      description: 'One person\'s week: hours logged per day and per project against their weekly hours, plus their overdue tasks and tasks due this week.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'my_week',
          server: 'team',
          person: fromAi('person', 'The person\'s name, e.g. "Leo Martins". If the user means themselves and you don\'t know their name, ask.', 'string'),
          week: fromAi('week', '"this" or "last"', 'string', 'this')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_team_capacity = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'team_capacity',
    position: [950, 520],
    parameters: {
      description: 'Who has room this week: hours logged so far against what they would normally have done by now, tasks due in the next 7 days, and a status of has room, busy or overloaded. Use it before suggesting who should take new work.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'team_capacity',
          server: 'team',
          team: fromAi('team', 'Design, Development, Delivery, Strategy or Operations; empty for everyone', 'string', '')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_log_time = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'log_time',
    position: [1100, 520],
    parameters: {
      description: 'Log hours someone worked on a project. Checks the project is active, hours are 0.25 to 12 in quarter hours, the day total stays under 12, the date is not in the future or older than 30 days, and the task belongs to the project. Returns the saved entry. Confirm the details with the user before calling if anything is unclear.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'log_time',
          server: 'team',
          person: fromAi('person', 'Who did the work', 'string'),
          project: fromAi('project', 'Project name or ID', 'string'),
          hours: fromAi('hours', 'Hours worked, e.g. 2.5', 'number'),
          date: fromAi('date', 'Date worked, YYYY-MM-DD; empty for today', 'string', ''),
          note: fromAi('note', 'What was done, one line', 'string', ''),
          task_id: fromAi('task_id', 'Task ID like T-1007 if known; empty otherwise', 'string', ''),
          billable: fromAi('billable', 'false only if the user says the time is not billable', 'boolean', true)
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_create_task = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'create_task',
    position: [1250, 520],
    parameters: {
      description: 'Add a task to a project. Returns the new task ID.',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'create_task',
          server: 'team',
          project: fromAi('project', 'Project name or ID', 'string'),
          title: fromAi('title', 'Short task title, starting with a verb, e.g. "Send revised logo files"', 'string'),
          assignee: fromAi('assignee', 'Who should do it; empty to leave unassigned', 'string', ''),
          due: fromAi('due', 'Due date YYYY-MM-DD; empty for none', 'string', ''),
          priority: fromAi('priority', 'low, normal or high', 'string', 'normal')
        },
        schema: TOOL_SCHEMA
      }
    }
  }
});

const t_update_task = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'update_task',
    position: [1400, 520],
    parameters: {
      description: 'Change a task\'s status (todo, doing, review, done), who it is assigned to, or its due date. Needs the task ID (find it with list_tasks or search).',
      source: 'database',
      workflowId: TOOLS_WF,
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          tool: 'update_task',
          server: 'team',
          task_id: fromAi('task_id', 'Task ID, e.g. T-1017', 'string'),
          status: fromAi('status', 'New status, or empty to leave it', 'string', ''),
          assignee: fromAi('assignee', 'New assignee, or empty to leave it', 'string', ''),
          due: fromAi('due', 'New due date YYYY-MM-DD, or empty to leave it', 'string', '')
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
    name: 'Brindle Studio',
    position: [800, 260],
    parameters: { authentication: 'bearerAuth', path: 'brindle' },
    credentials: { httpBearerAuth: { id: 'bmsTeamTokenCred', name: 'Brindle MCP: team token' } },
    subnodes: { tools: [t_search, t_client_overview, t_project_status, t_list_tasks, t_my_week, t_team_capacity, t_log_time, t_create_task, t_update_task] }
  }
});

const note = sticky(
  '## Brindle 1: Team MCP Server\nConnects Claude, ChatGPT, Cursor or any MCP client to Brindle Studio\'s projects, tasks, people and timesheets (a Google Sheet). URL: `/mcp/brindle`, with the team\'s bearer token. Nine tools: search, client and project health, task lists, someone\'s week, team capacity, and three that write: log time, create a task, update a task. Every tool runs **Brindle 3: Tools**, which checks the input, answers from the sheet and logs the call to the **Audit** tab. No money is shown here; that is the finance server.',
  [], { position: [140, -40], width: 1350, height: 200, color: 7 }
);

export default workflow('brindle-team-server', 'Brindle 1: Team MCP Server')
  .add(server)
  .add(note);
