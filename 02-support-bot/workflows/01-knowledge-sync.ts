import { workflow, node, trigger, sticky, ifElse, embeddings, documentLoader, textSplitter, expr } from '@n8n/workflow-sdk';

const DOC_ID = '1By8r-Hifea1hwlsW_M7oAkfqtUtnteXsqffg7B6w1Ow';
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

const docUpdated = trigger({
  type: 'n8n-nodes-base.googleDriveTrigger',
  version: 1,
  config: {
    name: 'Shop Info Doc Updated',
    position: [240, 240],
    parameters: {
      pollTimes: { item: [{ mode: 'everyX', value: 5, unit: 'minutes' }] },
      triggerOn: 'specificFile',
      fileToWatch: { __rl: true, mode: 'id', value: DOC_ID },
      event: 'fileUpdated'
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: DOC_ID, name: 'Copperline Auto Repair: Shop Info', modifiedTime: '2026-10-01T15:00:00.000Z' }]
});

const rebuildNow = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Rebuild Now', position: [240, 440] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [480, 340],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'file-id', name: 'FILE_ID', value: DOC_ID, type: 'string' },
          { id: 'file-name', name: 'FILE_NAME', value: 'Copperline Auto Repair: Shop Info', type: 'string' },
          { id: 'min-chars', name: 'MIN_CHARS', value: 500, type: 'number' },
          { id: 'version', name: 'VERSION', value: expr('{{ $now.toUTC().toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ FILE_ID: DOC_ID, FILE_NAME: 'Copperline Auto Repair: Shop Info', MIN_CHARS: 500, VERSION: '2026-10-01T15:00:00.000Z' }]
});

const exportDoc = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Export Doc as Markdown',
    position: [720, 340],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: expr('https://www.googleapis.com/drive/v3/files/{{ $json.FILE_ID }}/export?mimeType=text/markdown'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'text' } } }
    },
    credentials: DRIVE_CRED
  },
  output: [{ text: '# Copperline Auto Repair: Shop Info\n\n## Opening hours\n\n- Monday to Friday: 7:30 am to 6:00 pm.' }]
});

const hasContent = ifElse({
  version: 2.3,
  config: {
    name: 'Doc Has Content?',
    position: [960, 340],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            leftValue: expr('{{ ($json.text ?? "").trim().length }}'),
            rightValue: expr("{{ $('Config').item.json.MIN_CHARS }}"),
            operator: { type: 'number', operation: 'gte' }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const refuseEmptyDoc = node({
  type: 'n8n-nodes-base.stopAndError',
  version: 1,
  config: {
    name: 'Refuse Near-Empty Doc',
    position: [1200, 520],
    parameters: {
      errorType: 'errorMessage',
      errorMessage: "The shop info doc has fewer than 500 characters, so it was not re-indexed and the bot keeps its current knowledge. Check the Google Doc for an accidental deletion (File > Version history)."
    }
  },
  output: [{}]
});

const embedder = embeddings({
  type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  version: 1.2,
  config: {
    name: 'OpenAI Embeddings',
    position: [1160, 560],
    parameters: { model: 'text-embedding-3-small' },
    credentials: { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } }
  }
});

const splitter = textSplitter({
  type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter',
  version: 1,
  config: {
    name: 'Split by Section',
    position: [1400, 720],
    parameters: { chunkSize: 500, chunkOverlap: 80, options: { splitCode: 'markdown' } }
  }
});

const loader = documentLoader({
  type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  version: 1.1,
  config: {
    name: 'Shop Info Text',
    position: [1360, 560],
    parameters: {
      dataType: 'json',
      jsonMode: 'expressionData',
      jsonData: expr('{{ $json.text.replace(/\\\\([$.()!#*_\\[\\]\\-+])/g, "$1") }}'),
      textSplittingMode: 'custom',
      options: {
        metadata: {
          metadataValues: [
            { name: 'file_id', value: expr("{{ $('Config').item.json.FILE_ID }}") },
            { name: 'file_name', value: expr("{{ $('Config').item.json.FILE_NAME }}") },
            { name: 'version', value: expr("{{ $('Config').item.json.VERSION }}") }
          ]
        }
      }
    },
    subnodes: { textSplitter: splitter }
  }
});

const addChunks = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'Add Chunks to Supabase',
    position: [1200, 240],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      mode: 'insert',
      tableName: { __rl: true, mode: 'id', value: 'documents' },
      options: { queryName: 'match_documents' }
    },
    subnodes: { embedding: embedder, documentLoader: loader },
    credentials: { supabaseApi: { id: 'KdLzNsI1fZqoPyCt', name: 'Supabase account' } }
  },
  output: [{ pageContent: '## Opening hours', metadata: { file_id: DOC_ID } }]
});

const removeOldChunks = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Remove Old Chunks',
    position: [1440, 240],
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      operation: 'executeQuery',
      query: "with fresh as (select count(*)::int as n from documents where metadata->>'file_id' = $1 and metadata->>'version' = $2), deleted as (delete from documents where metadata->>'file_id' = $1 and coalesce(metadata->>'version', '') <> $2 and (select n from fresh) > 0 returning id) select (select n from fresh) as chunks_indexed, (select count(*)::int from deleted) as old_chunks_removed",
      options: {
        queryReplacement: expr("{{ $('Config').item.json.FILE_ID }},{{ $('Config').item.json.VERSION }}")
      }
    },
    credentials: { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } }
  },
  output: [{ chunks_indexed: 24, old_chunks_removed: 24 }]
});

const checkIndexed = ifElse({
  version: 2.3,
  config: {
    name: 'New Chunks Saved?',
    position: [1680, 240],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.chunks_indexed }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }
        ],
        combinator: 'and'
      }
    }
  }
});

const syncSummary = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Sync Summary',
    position: [1920, 160],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'doc', name: 'doc', value: expr("{{ $('Config').item.json.FILE_NAME }}"), type: 'string' },
          { id: 'version', name: 'version', value: expr("{{ $('Config').item.json.VERSION }}"), type: 'string' },
          { id: 'chunks', name: 'chunks_indexed', value: expr('{{ $json.chunks_indexed }}'), type: 'number' },
          { id: 'removed', name: 'old_chunks_removed', value: expr('{{ $json.old_chunks_removed }}'), type: 'number' }
        ]
      }
    }
  },
  output: [{ doc: 'Copperline Auto Repair: Shop Info', version: '2026-10-01T15:00:00.000Z', chunks_indexed: 24, old_chunks_removed: 24 }]
});

const nothingSaved = node({
  type: 'n8n-nodes-base.stopAndError',
  version: 1,
  config: {
    name: 'Fail: Nothing Indexed',
    position: [1920, 360],
    parameters: {
      errorType: 'errorMessage',
      errorMessage: 'No new chunks were saved to Supabase, so the old chunks were kept. Check the OpenAI and Supabase credentials and the execution log.'
    }
  },
  output: [{}]
});

const noteOverview = sticky(
  '## Knowledge Sync\n' +
  "Keeps the chat bot's knowledge in step with the **Copperline Auto Repair: Shop Info** Google Doc.\n\n" +
  '1. Runs when the doc changes (checked every 5 minutes) or when you click **Rebuild Now**.\n' +
  '2. Exports the doc as Markdown.\n' +
  "3. Refuses to index a doc under 500 characters, so an accidental delete can't wipe the bot's knowledge.",
  [docUpdated, rebuildNow, config, exportDoc, hasContent],
  { color: 4 }
);

const noteIndex = sticky(
  '## Insert first, delete second\n' +
  "New chunks are embedded (OpenAI `text-embedding-3-small`) and saved to Supabase with this run's `version`. Only then are the doc's older chunks deleted, and only if the new ones exist. The bot never sees an empty index, even if a step fails half-way.",
  [addChunks, removeOldChunks, checkIndexed, syncSummary, nothingSaved],
  { color: 5 }
);

export default workflow('support-bot-knowledge-sync', 'Support Bot 1: Knowledge Sync')
  .add(docUpdated)
  .to(config)
  .add(rebuildNow)
  .to(config)
  .to(exportDoc)
  .to(hasContent
    .onTrue(addChunks.to(removeOldChunks).to(checkIndexed.onTrue(syncSummary).onFalse(nothingSaved)))
    .onFalse(refuseEmptyDoc))
  .add(noteOverview)
  .add(noteIndex);
