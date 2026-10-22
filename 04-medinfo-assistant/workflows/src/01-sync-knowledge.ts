import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const every15 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 15 Minutes',
    position: [200, 240],
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } }
  },
  output: [{ timestamp: '2026-10-07T04:15:00.000-04:00' }]
});

const syncNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Sync Now', position: [200, 440] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [440, 340],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'pub', name: 'PUBLIC_FOLDER', value: '1Z6oysFHKsOfsN0ssBTJ1kX_AxbrEJaY9', type: 'string' },
          { id: 'int', name: 'INTERNAL_FOLDER', value: '1XdFQSXG1zbbdlXSAx5oxwiDPL9mZoCbb', type: 'string' },
          { id: 'med', name: 'MEDICAL_FOLDER', value: '1dun6GEtKJLy2oX0WwjhZ3ZpbZbRdexVd', type: 'string' },
          { id: 'data', name: 'DATA_FOLDER', value: '1qEeUAbg-8wamu2JvC2c47U7JO5_fcaYf', type: 'string' },
          { id: 'parser', name: 'PARSER_VERSION', value: 1, type: 'number' },
          { id: 'force', name: 'FORCE_REINDEX', value: false, type: 'boolean' }
        ]
      }
    }
  },
  output: [{ PUBLIC_FOLDER: '1Z6o', INTERNAL_FOLDER: '1XdF', MEDICAL_FOLDER: '1dun', DATA_FOLDER: '1qEe', PARSER_VERSION: 1, FORCE_REINDEX: false }]
});

const listFiles = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'List Drive Files',
    position: [680, 340],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'q', value: expr("('{{ $json.PUBLIC_FOLDER }}' in parents or '{{ $json.INTERNAL_FOLDER }}' in parents or '{{ $json.MEDICAL_FOLDER }}' in parents or '{{ $json.DATA_FOLDER }}' in parents) and trashed = false and mimeType != 'application/vnd.google-apps.folder'") },
          { name: 'fields', value: 'files(id,name,mimeType,modifiedTime,webViewLink,parents)' },
          { name: 'pageSize', value: '1000' }
        ]
      }
    },
    credentials: DRIVE_CRED
  },
  output: [{ files: [{ id: '1y5G', name: 'Quenvara Prescribing Information v5.0.pdf', mimeType: 'application/pdf', modifiedTime: '2026-10-07T03:03:30.000Z', webViewLink: 'https://drive.google.com/file/d/1y5G/view', parents: ['1Z6o'] }] }]
});

const readRegistry = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Read Registry',
    position: [920, 340],
    executeOnce: true,
    parameters: {
      operation: 'executeQuery',
      query: "select kb_registry('{}'::jsonb) as registry;"
    },
    credentials: PG_CRED
  },
  output: [{ registry: [{ id: '1y5G', doc_code: 'LRK-PI-QNV', modified_time: '2026-10-07T03:03:30+00:00', parser_version: 1, access_level: 'public' }] }]
});

const workOutChanges = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Work Out Changes',
    position: [1160, 340],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__WORK_OUT_CHANGES__
    }
  },
  output: [{ action: 'index', reason: 'new', file_id: '1y5G', file_name: 'Quenvara Prescribing Information v5.0.pdf', mime_type: 'application/pdf', modified_time: '2026-10-07T03:03:30.000Z', url: 'https://drive.google.com/file/d/1y5G/view', folder: 'Public', access_level: 'public' }]
});

const action = switchCase({
  version: 3.4,
  config: {
    name: 'Action',
    position: [1400, 340],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: 'Delete',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'delete', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'Index',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'index', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          },
          {
            renameOutput: true,
            outputKey: 'Nothing to Do',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'none', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and'
            }
          }
        ]
      }
    }
  }
});

const deleteDoc = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Delete From Index',
    position: [1660, 140],
    parameters: {
      operation: 'executeQuery',
      query: 'select kb_delete_document($1::jsonb) as result;',
      options: { queryReplacement: expr('{{ JSON.stringify({ id: $json.id }) }}'), queryBatching: 'independently' }
    },
    credentials: PG_CRED
  },
  output: [{ result: { id: '1abc', doc_code: 'LRK-SRL-QNV-001', deleted: true } }]
});

const indexDoc = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Index Document',
    position: [1660, 340],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'DyjixtsLLbSxl5yp', cachedResultName: 'MedInfo 2: Index Document' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          file_id: expr('{{ $json.file_id }}'),
          file_name: expr('{{ $json.file_name }}'),
          mime_type: expr('{{ $json.mime_type }}'),
          modified_time: expr('{{ $json.modified_time }}'),
          url: expr('{{ $json.url }}'),
          folder: expr('{{ $json.folder }}'),
          access_level: expr('{{ $json.access_level }}')
        },
        schema: [
          { id: 'file_id', displayName: 'file_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'file_name', displayName: 'file_name', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'mime_type', displayName: 'mime_type', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'modified_time', displayName: 'modified_time', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'folder', displayName: 'folder', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'access_level', displayName: 'access_level', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ]
      },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ status: 'indexed', file_name: 'Quenvara Prescribing Information v5.0.pdf', doc_code: 'LRK-PI-QNV', chunks: 36, version_status: 'current', parse_method: 'pdf_model', parse_flags: [], number_check: 1 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Sync Summary',
    position: [1900, 340],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SYNC_SUMMARY__
    }
  },
  output: [{ indexed: 13, skipped: 0, failed: 0, deleted: 0, files: [] }]
});

const anyFailed = ifElse({
  version: 2.3,
  config: {
    name: 'Any Failures?',
    position: [2140, 340],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.failed }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and'
      }
    }
  }
});

const failRun = node({
  type: 'n8n-nodes-base.stopAndError',
  version: 1,
  config: {
    name: 'Report Failed Files',
    position: [2380, 260],
    parameters: {
      errorType: 'errorMessage',
      errorMessage: expr('{{ $json.failed }} file(s) could not be indexed: {{ $json.files.filter(f => f.status === "failed").map(f => f.file + " (" + f.error + ")").join("; ") }}. Their previous versions stay in the index; the next sync retries them.')
    }
  },
  output: [{}]
});

const nothingToDo = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Index Up to Date',
    position: [1660, 540],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: { assignments: [{ id: 'msg', name: 'message', value: 'No new, changed or deleted files.', type: 'string' }] }
    }
  },
  output: [{ action: 'none', files: 13, indexed: 13, message: 'No new, changed or deleted files.' }]
});

const note = sticky(
  '## MedInfo 1: Sync Knowledge\n' +
  'Every 15 minutes, compares the four Drive folders with the index (`kb_registry`).\n\n' +
  '- **New, edited or moved files** go to **MedInfo 2: Index Document**, one at a time. A failure on one file does not stop the others; the run is marked failed at the end and lists them.\n' +
  '- **Files deleted from Drive** are removed with `kb_delete_document`, which also promotes the previous version of that document if there is one.\n' +
  '- **Guards**: an empty Drive listing, or one that would delete more than half the index, stops the run instead of wiping the knowledge base.\n' +
  '- The folder sets the access level: Public and Data → `public`, Internal → `internal`, Medical → `medical`.',
  [every15, syncNow, config, listFiles, readRegistry, workOutChanges, action],
  { color: 4 }
);

export default workflow('medinfo-sync-knowledge', 'MedInfo 1: Sync Knowledge')
  .add(every15)
  .to(config)
  .add(syncNow)
  .to(config)
  .to(listFiles)
  .to(readRegistry)
  .to(workOutChanges)
  .to(action
    .onCase(0, deleteDoc)
    .onCase(1, indexDoc.to(summary).to(anyFailed.onTrue(failRun)))
    .onCase(2, nothingToDo))
  .add(note);
