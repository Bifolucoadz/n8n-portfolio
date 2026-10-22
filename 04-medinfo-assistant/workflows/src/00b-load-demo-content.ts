import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Load Demo Content', position: [200, 300] },
  output: [{}]
});

const rootFolder = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Root Folder',
    position: [420, 300],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: { name: 'Larkmoor MedInfo Knowledge', mimeType: 'application/vnd.google-apps.folder' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'root1', name: 'Larkmoor MedInfo Knowledge', webViewLink: 'https://drive.google.com/drive/folders/root1' }]
});

const subfolderList = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Subfolder List',
    position: [640, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__SUBFOLDER_LIST__
    }
  },
  output: [{ name: 'Public', parent: 'root1' }]
});

const createSubfolders = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Subfolders',
    position: [860, 300],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { name: $json.name, mimeType: "application/vnd.google-apps.folder", parents: [$json.parent] } }}')
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'f1', name: 'Public', webViewLink: 'https://drive.google.com/drive/folders/f1' }]
});

const getManifest = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Manifest',
    position: [1080, 300],
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: 'http://127.0.0.1:8765/manifest.json',
      options: { response: { response: { responseFormat: 'json' } } }
    }
  },
  output: [{ file: 'quenvara.pdf', name: 'Quenvara Prescribing Information v5.0.pdf', folder: 'Public', kind: 'pdf', doc_code: 'LRK-PI-QNV', version: '5.0' }]
});

const planUploads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan Uploads',
    position: [1300, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__PLAN_UPLOADS__
    }
  },
  output: [{ file: 'quenvara.pdf', name: 'Quenvara Prescribing Information v5.0.pdf', folder: 'Public', kind: 'pdf', folder_id: 'f1', url: 'http://127.0.0.1:8765/quenvara.pdf', target_mime: 'application/pdf', source_mime: 'application/pdf' }]
});

const isPdf = ifElse({
  version: 2.3,
  config: {
    name: 'PDF?',
    position: [1520, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ leftValue: expr('{{ $json.kind }}'), rightValue: 'pdf', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      }
    }
  }
});

const downloadPdf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download PDF',
    position: [1760, 180],
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    }
  },
  output: [{}]
});

const uploadPdf = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload PDF to Drive',
    position: [2000, 180],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr("{{ $('Plan Uploads').item.json.name }}"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $('Plan Uploads').item.json.folder_id }}") },
      options: {}
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'pdf1', name: 'Quenvara Prescribing Information v5.0.pdf' }]
});

const downloadText = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Markdown or CSV',
    position: [1760, 420],
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'text' } } }
    }
  },
  output: [{ text: '# SOP' }]
});

const buildMultipart = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Multipart Body',
    position: [2000, 420],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
__BUILD_MULTIPART__
    }
  },
  output: [{ name: 'SOP-PV-001 Adverse event intake and reporting', boundary: 'larkmoor-abc', body: '--larkmoor-abc' }]
});

const uploadGoogle = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Upload as Google Doc or Sheet',
    position: [2240, 420],
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      contentType: 'raw',
      rawContentType: expr('multipart/related; boundary={{ $json.boundary }}'),
      body: expr('{{ $json.body }}')
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'doc1', name: 'SOP-PV-001 Adverse event intake and reporting', mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/document/d/doc1/edit' }]
});

const note = sticky(
  '## Load the demo knowledge base (run once)\n' +
  'Creates **Larkmoor MedInfo Knowledge** in Google Drive with `Public`, `Internal`, `Medical` and `Data` subfolders, then uploads everything in `knowledge/out/`:\n\n' +
  '- Prescribing Information PDFs and a scanned Dear HCP letter → `Public`\n' +
  '- Standard response letters (Markdown → Google Docs) → `Medical`\n' +
  '- SOPs (Markdown → Google Docs) → `Internal`\n' +
  '- Product catalog (CSV → Google Sheet) → `Data`\n\n' +
  'Before running: `python3 knowledge/build.py`, then serve `knowledge/out` with `python3 -m http.server 8765 --bind 127.0.0.1`.',
  [start, rootFolder, subfolderList, createSubfolders, getManifest, planUploads],
  { color: 4 }
);

export default workflow('medinfo-load-demo-content', 'MedInfo 0b: Load Demo Content')
  .add(start)
  .to(rootFolder)
  .to(subfolderList)
  .to(createSubfolders)
  .to(getManifest)
  .to(planUploads)
  .to(isPdf
    .onTrue(downloadPdf.to(uploadPdf))
    .onFalse(downloadText.to(buildMultipart).to(uploadGoogle)))
  .add(note);
