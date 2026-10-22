import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const IMAGES_FOLDER = { __rl: true, mode: 'id', value: '1cDvsqSOz8QBTZFWbUj4z-Gu3NQBriVUu', cachedResultName: 'Social Autopilot/Images' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const CAL_UPDATE_COLUMNS = {
  mappingMode: 'autoMapInputData',
  value: {},
  matchingColumns: ['post_id'],
  schema: [
__CAL_SCHEMA__
  ]
};

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [240, 400],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'post_id', type: 'string' }, { name: 'feedback', type: 'string' }] } }
  },
  output: [{ post_id: 'P-TEST1', feedback: '' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [460, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'brand_name', value: 'Samuel Oladele' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calendar',
    position: [680, 400],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: CAL_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, post_id: 'P-TEST1', topic: 'Why small businesses lose leads', status: 'drafting' }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read State',
    position: [900, 400],
    executeOnce: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true }
  },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const prepareBrief = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Brief',
    position: [1120, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__PREPARE_BRIEF__
    }
  },
  output: [{ post_id: 'P-TEST1', topic: 'Why small businesses lose leads', link: '', platforms: ['linkedin', 'telegram'], image: { mode: 'ai' }, approver: '123456' }]
});

const hasLink = ifElse({
  version: 2.2,
  config: {
    name: 'Has Link?',
    position: [1340, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.link }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const fetchPage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Linked Page',
    position: [1560, 260],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.link }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' }] },
      options: { timeout: 15000, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } }
    }
  },
  output: [{ data: '<html><title>Example</title></html>' }]
});

const extractPage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Page',
    position: [1780, 260],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__EXTRACT_PAGE__
    }
  },
  output: [{ page: { title: 'Example', description: '', text: 'Example page' } }]
});

const buildPrompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Prompt',
    position: [2000, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__BUILD_PROMPT__
    }
  },
  output: [{ prompt: 'TODAY: ...' }]
});

const writePosts = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Write Posts',
    position: [2220, 400],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5.5' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      options: {
        instructions:
__PROMPT_WRITER__
        ,
        maxTokens: 6000,
        store: false,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'social_posts', strict: true, schema:
__SCHEMA_WRITER__
        } }
      }
    },
    credentials: OPENAI_CRED
  },
  output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: { angle: 'a', linkedin: 'b', telegram: 'd', image_prompt: 'e', image_alt: 'f' } }] }] }]
});

const checkDrafts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Check Drafts',
    position: [2440, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__CHECK_DRAFTS__
    }
  },
  output: [{ ok: true, post_id: 'P-TEST1', linkedin: 'b', telegram: 'd', notes: [], image_request: { model: 'gpt-image-2' } }]
});

const draftOk = ifElse({
  version: 2.2,
  config: {
    name: 'Draft OK?',
    position: [2660, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const saveFailure = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Failure',
    position: [2880, 760],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'update', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: CAL_UPDATE_COLUMNS, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-TEST1', status: 'idea' }]
});

const gaveUp = ifElse({
  version: 2.2,
  config: {
    name: 'Gave Up?',
    position: [3100, 760],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Check Drafts').first().json.give_up }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const tellOwnerFailed = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Tell Owner Drafting Failed',
    position: [3320, 700],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Prepare Brief').first().json.approver }}"),
      text: expr("⚠️ I couldn't draft <code>{{ $('Prepare Brief').first().json.post_id }}</code> ({{ $('Prepare Brief').first().json.topic.replace(/&/g, '&amp;').replace(/</g, '&lt;') }}) after 3 tries. It's marked needs_fix in the sheet.\n\nLast error: {{ $('Check Drafts').first().json.error.replace(/&/g, '&amp;').replace(/</g, '&lt;') }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const imageSource = switchCase({
  version: 3.2,
  config: {
    name: 'Image Source',
    position: [2880, 400],
    parameters: {
      rules: {
        values: [
          { outputKey: 'ai', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Prepare Brief').first().json.image.mode }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'ai' }], combinator: 'and' } },
          { outputKey: 'drive', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Prepare Brief').first().json.image.mode }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'drive' }], combinator: 'and' } },
          { outputKey: 'url', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Prepare Brief').first().json.image.mode }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'url' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'no image' }
    }
  }
});

const generateImage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Generate Image',
    position: [3100, 140],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/images/generations',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.image_request }}'),
      options: { timeout: 240000 }
    },
    credentials: OPENAI_CRED
  },
  output: [{ data: [{ b64_json: 'abc' }] }]
});

const imageToFile = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Image To File',
    position: [3320, 140],
    parameters: {
      operation: 'toBinary',
      sourceProperty: 'data[0].b64_json',
      options: { fileName: expr("{{ $('Prepare Brief').first().json.post_id }}.jpg"), mimeType: 'image/jpeg' }
    }
  },
  output: [{}]
});

const saveImage = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Save Image To Drive',
    position: [3540, 140],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr("{{ $('Prepare Brief').first().json.post_id }} {{ $now.toFormat('yyyy-MM-dd HHmm') }}.jpg"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: IMAGES_FOLDER,
      options: {}
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'img1', name: 'P-TEST1.jpg' }]
});

const imageReady = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Image Ready',
    position: [3760, 140],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__IMAGE_READY__
    }
  },
  output: [{ image_file_id: 'img1', image_link: 'https://drive.google.com/file/d/img1/view', image_error: '' }]
});

const downloadDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download Drive Image',
    position: [3100, 380],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'file',
      operation: 'download',
      fileId: { __rl: true, mode: 'id', value: expr("{{ $('Prepare Brief').first().json.image.file_id }}") },
      options: { binaryPropertyName: 'data' }
    },
    credentials: DRIVE_CRED
  },
  output: [{ id: 'img1', name: 'P-TEST1.jpg' }]
});

const downloadUrl = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Image URL',
    position: [3100, 580],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr("{{ $('Prepare Brief').first().json.image.url }}"),
      options: { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    }
  },
  output: [{}]
});

const assemble = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assemble Draft',
    position: [3980, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__ASSEMBLE_DRAFT__
    }
  },
  output: [{ post_id: 'P-TEST1', approver: '123456', preview: 'New draft', has_image: true, old_preview_id: '', row: { post_id: 'P-TEST1', status: 'in_review' } }]
});

const hasImage = ifElse({
  version: 2.2,
  config: {
    name: 'Has Image?',
    position: [4200, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.has_image }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const sendImagePreview = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Image Preview',
    position: [4420, 260],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendPhoto',
      chatId: expr('{{ $json.approver }}'),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: { caption: expr('🖼 Image for <code>{{ $json.post_id }}</code>'), parse_mode: 'HTML', fileName: expr('{{ $json.post_id }}.jpg') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { message_id: 10 } }]
});

const hasOldPreview = ifElse({
  version: 2.2,
  config: {
    name: 'Has Old Preview?',
    position: [4640, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $('Assemble Draft').first().json.old_preview_id }}"), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const markOldPreview = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Mark Old Preview Replaced',
    position: [4860, 260],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'editMessageText',
      messageType: 'message',
      chatId: expr("{{ $('Assemble Draft').first().json.approver }}"),
      messageId: expr("{{ $('Assemble Draft').first().json.old_preview_id }}"),
      replyMarkup: 'none',
      text: expr("↻ <s>Draft <code>{{ $('Assemble Draft').first().json.post_id }}</code></s> was replaced by the new version below."),
      additionalFields: { parse_mode: 'HTML' }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const sendDraftPreview = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Draft Preview',
    position: [5080, 400],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Assemble Draft').first().json.approver }}"),
      text: expr("{{ $('Assemble Draft').first().json.preview }}"),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [
        { row: { buttons: [
          { text: '✅ Approve', additionalFields: { callback_data: expr("ap:{{ $('Assemble Draft').first().json.post_id }}") } },
          { text: '✏️ Rewrite', additionalFields: { callback_data: expr("rw:{{ $('Assemble Draft').first().json.post_id }}") } }
        ] } },
        { row: { buttons: [
          { text: '🚀 Post now', additionalFields: { callback_data: expr("pn:{{ $('Assemble Draft').first().json.post_id }}") } },
          { text: '🗑 Reject', additionalFields: { callback_data: expr("rj:{{ $('Assemble Draft').first().json.post_id }}") } }
        ] } }
      ] },
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { message_id: 11 } }]
});

const draftRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Draft Row',
    position: [5300, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
__DRAFT_ROW__
    }
  },
  output: [{ post_id: 'P-TEST1', status: 'in_review', preview_message_id: '11' }]
});

const saveDraft = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Draft',
    position: [5520, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'update', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: CAL_UPDATE_COLUMNS, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-TEST1', status: 'in_review' }]
});

const noteMain = sticky(
  '## Draft Post\n' +
  'Called by the Clock (due ideas) and by the Telegram handler (Rewrite button, or a reply asking for changes). The caller sets the row to `drafting` first; any other status and this run stops.\n\n' +
  '1. Reads the row, Settings, recent posts and (if there is a link) the linked page.\n' +
  '2. **Write Posts**: GPT-5.5 writes a LinkedIn and a Telegram version as strict JSON (prompt in `prompts/writer.md`).\n' +
  '3. **Check Drafts** fits each to its limit (LinkedIn 3,000 characters, Telegram caption 1,024).\n' +
  '4. Image: generated with gpt-image-2 and filed in Drive, reused from Drive, downloaded from a URL, or none.\n' +
  '5. Sends the preview with buttons to the approver and saves everything to the sheet (`in_review`).',
  [], { position: [200, -120], width: 760, height: 330, color: 4 }
);

const noteImage = sticky(
  '### Images\nThe OpenAI image node can\'t return JPEG, so the Images API is called directly for a ~200 KB JPEG. A failed image never blocks the draft: the error goes in the preview and the post can go out text-only.',
  [], { position: [3060, -120], width: 760, height: 200, color: 7 }
);

export default workflow('social-autopilot-draft', 'Social Autopilot 5: Draft Post')
  .add(whenCalled)
  .to(readSettings)
  .to(readCalendar)
  .to(readState)
  .to(prepareBrief)
  .to(hasLink
    .onTrue(fetchPage.to(extractPage.to(buildPrompt)))
    .onFalse(buildPrompt))
  .add(buildPrompt)
  .to(writePosts)
  .to(checkDrafts)
  .to(draftOk
    .onTrue(imageSource
      .onCase(0, generateImage.to(imageToFile.to(saveImage.to(imageReady.to(assemble)))))
      .onCase(1, downloadDrive.to(assemble))
      .onCase(2, downloadUrl.to(assemble))
      .onCase(3, assemble))
    .onFalse(saveFailure.to(gaveUp.onTrue(tellOwnerFailed))))
  .add(generateImage.onError(assemble))
  .add(downloadDrive.onError(assemble))
  .add(downloadUrl.onError(assemble))
  .add(assemble)
  .to(hasImage
    .onTrue(sendImagePreview.to(hasOldPreview))
    .onFalse(hasOldPreview))
  .add(hasOldPreview
    .onTrue(markOldPreview.to(sendDraftPreview))
    .onFalse(sendDraftPreview))
  .add(sendDraftPreview)
  .to(draftRow)
  .to(saveDraft)
  .add(noteMain)
  .add(noteImage);
