import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };

const newFile = trigger({
  type: 'n8n-nodes-base.googleDriveTrigger',
  version: 1,
  config: {
    name: 'New File in Inbox',
    position: [240, 300],
    parameters: {
      pollTimes: { item: [{ mode: 'everyMinute' }] },
      triggerOn: 'specificFolder',
      folderToWatch: { __rl: true, mode: 'id', value: '1J2vZVSbMIkIj3dDn28EQG6lvYbb1ySx6', cachedResultName: 'Inbox' },
      event: 'fileCreated',
      options: { fileType: 'all' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', name: 'receipt.jpg', mimeType: 'image/jpeg', createdTime: '2026-10-01T22:00:00.000Z' }]
});

const download = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download File',
    position: [480, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'file',
      operation: 'download',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.id }}') },
      options: { binaryPropertyName: 'data' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', name: 'receipt.jpg' }]
});

const prepare = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare',
    position: [720, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
__PREPARE__
    }
  },
  output: [{ source: 'drive', sender: 'samuelgurru@gmail.com', original_filename: 'receipt.jpg', received_at: '2026-10-01T18:00:00.000-04:00', drive_file_id: '1abc' }]
});

const processDoc = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Process Document',
    position: [960, 300],
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'each',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'v9Mp2015O3VcFURY', cachedResultName: 'Invoice Desk 1: Process Document' },
      options: { waitForSubWorkflow: true }
    }
  },
  output: [{ doc_id: 'SK-261001-K7QM', status: 'auto_approved' }]
});

const moveDone = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Move Original to Done',
    position: [1200, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'file',
      operation: 'move',
      fileId: { __rl: true, mode: 'id', value: expr("{{ $('Prepare').all()[$itemIndex].json.drive_file_id }}") },
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: '1OwAnTllBb8jOo8p--Gm2LiT01LzSS-Q1', cachedResultName: 'Done' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: '1abc', name: 'receipt.jpg' }]
});

const note = sticky(
  '## Drive Intake\n' +
  'Drop a file (or a phone scan) into **Invoice Desk (Saltmarsh Kitchen)/Inbox** in Google Drive. Checked every minute.\n\n' +
  'The file goes through **Process Document**, which files a renamed copy under Filed or Other. The original then moves to **Inbox/Done**, so the Inbox only ever holds what has not been read yet.',
  [newFile, download, prepare, processDoc, moveDone],
  { color: 4 }
);

export default workflow('invoice-desk-drive-intake', 'Invoice Desk 5: Drive Intake')
  .add(newFile)
  .to(download)
  .to(prepare)
  .to(processDoc)
  .to(moveDone)
  .add(note);
