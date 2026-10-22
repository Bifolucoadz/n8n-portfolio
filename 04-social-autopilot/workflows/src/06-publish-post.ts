import { workflow, node, trigger, sticky, ifElse, switchCase, merge, newCredential, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const CAL_TAB = { __rl: true, mode: 'id', value: '0', cachedResultName: 'Calendar' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const DRIVE_CRED = { googleDriveOAuth2Api: { id: 'sN9bbP0t0u0A88QU', name: 'Google Drive account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };
const CAL_UPDATE_COLUMNS = {
  mappingMode: 'autoMapInputData',
  value: {},
  matchingColumns: ['post_id'],
  schema: [
__CAL_SCHEMA__
  ]
};
const BOOL_TRUE = { type: 'boolean', operation: 'true', singleValue: true };
const COND_OPTS = { caseSensitive: true, leftValue: '', typeValidation: 'loose' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called',
    position: [240, 600],
    parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'post_id', type: 'string' }] } }
  },
  output: [{ post_id: 'P-TEST1' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [460, 600],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'mode', value: 'test' }]
});

const readCalendar = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Calendar',
    position: [680, 600],
    executeOnce: true,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: CAL_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, post_id: 'P-TEST1', status: 'publishing' }]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Read State',
    position: [900, 600],
    executeOnce: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true }
  },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const preparePublish = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Publish',
    position: [1120, 600],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__PREPARE_PUBLISH__
    }
  },
  output: [{ post_id: 'P-TEST1', needs: ['linkedin', 'telegram'], need_li: true, need_tg: true, image: { mode: 'drive', file_id: 'img1' }, test_mode: true, approver: '123456', channel: '@demo' }]
});

const imageSource = switchCase({
  version: 3.2,
  config: {
    name: 'Image Source',
    position: [1340, 600],
    parameters: {
      rules: {
        values: [
          { outputKey: 'drive', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.image.mode }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'drive' }], combinator: 'and' } },
          { outputKey: 'url', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.image.mode }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'url' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'no image' }
    }
  }
});

const downloadDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download Drive Image',
    position: [1560, 440],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'file',
      operation: 'download',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.image.file_id }}') },
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
    position: [1560, 620],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.image.url }}'),
      options: { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    }
  },
  output: [{}]
});

const attachImage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Attach Image',
    position: [1780, 600],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__ATTACH_IMAGE__
    }
  },
  output: [{ post_id: 'P-TEST1', need_li: true, need_tg: true, has_image: true, tg_photo: true, test_mode: true, link: '', approver: '123456', channel: '@demo', test_message: 'Test mode', notes: [] }]
});

const testMode = ifElse({
  version: 2.2,
  config: {
    name: 'Test Mode?',
    position: [2000, 600],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.test_mode }}'), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});


const testHasImage = ifElse({
  version: 2.2,
  config: {
    name: 'Test Has Image?',
    position: [2220, 160],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.has_image }}'), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});

const sendTestImage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Test Image',
    position: [2440, 80],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendPhoto',
      chatId: expr('{{ $json.approver }}'),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: { caption: expr('🧪 Test mode image for <code>{{ $json.post_id }}</code>'), parse_mode: 'HTML', fileName: expr('{{ $json.post_id }}.jpg') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const sendTestPosts = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Test Posts',
    position: [2660, 160],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Attach Image').first().json.approver }}"),
      text: expr("{{ $('Attach Image').first().json.test_message }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const testRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Test Row',
    position: [2880, 160],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TEST_ROW__
    }
  },
  output: [{ post_id: 'P-TEST1', status: 'test_posted' }]
});

const saveTest = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Test Result',
    position: [3100, 160],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'update', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: CAL_UPDATE_COLUMNS, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-TEST1' }]
});


const postLinkedIn = ifElse({
  version: 2.2,
  config: {
    name: 'Post to LinkedIn?',
    position: [2220, 440],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.need_li }}'), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});

const linkedInFormat = switchCase({
  version: 3.2,
  config: {
    name: 'LinkedIn Format',
    position: [2440, 440],
    parameters: {
      rules: {
        values: [
          { outputKey: 'image', conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.has_image }}'), operator: BOOL_TRUE }], combinator: 'and' } },
          { outputKey: 'link', conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.link }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'text' }
    }
  }
});

const linkedInImage = node({
  type: 'n8n-nodes-base.linkedIn',
  version: 1,
  config: {
    name: 'LinkedIn With Image',
    position: [2660, 340],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'post',
      operation: 'create',
      authentication: 'standard',
      postAs: 'person',
      person: expr('{{ $json.linkedin_person }}'),
      text: expr('{{ $json.linkedin_text }}'),
      shareMediaCategory: 'IMAGE',
      binaryPropertyName: 'data',
      additionalFields: { title: expr('{{ $json.topic }}'), visibility: expr('{{ $json.visibility }}') }
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn account') }
  },
  output: [{ urn: 'urn:li:share:1' }]
});

const linkedInLink = node({
  type: 'n8n-nodes-base.linkedIn',
  version: 1,
  config: {
    name: 'LinkedIn With Link',
    position: [2660, 460],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'post',
      operation: 'create',
      authentication: 'standard',
      postAs: 'person',
      person: expr('{{ $json.linkedin_person }}'),
      text: expr('{{ $json.linkedin_text }}'),
      shareMediaCategory: 'ARTICLE',
      additionalFields: {
        originalUrl: expr('{{ $json.link }}'),
        title: expr('{{ $json.card ? $json.card.title : $json.topic }}'),
        description: expr("{{ $json.card ? $json.card.description : '' }}"),
        visibility: expr('{{ $json.visibility }}')
      }
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn account') }
  },
  output: [{ urn: 'urn:li:share:2' }]
});

const linkedInText = node({
  type: 'n8n-nodes-base.linkedIn',
  version: 1,
  config: {
    name: 'LinkedIn Text Only',
    position: [2660, 580],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'post',
      operation: 'create',
      authentication: 'standard',
      postAs: 'person',
      person: expr('{{ $json.linkedin_person }}'),
      text: expr('{{ $json.linkedin_text }}'),
      shareMediaCategory: 'NONE',
      additionalFields: { visibility: expr('{{ $json.visibility }}') }
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn account') }
  },
  output: [{ urn: 'urn:li:share:3' }]
});

const linkedInResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'LinkedIn Result',
    position: [2880, 440],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__LINKEDIN_RESULT__
    }
  },
  output: [{ platform: 'linkedin', status: 'ok', url: 'https://www.linkedin.com/feed/update/urn:li:share:1/' }]
});

const postTelegram = ifElse({
  version: 2.2,
  config: {
    name: 'Post to Telegram?',
    position: [2220, 760],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.need_tg }}'), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});

const channelPhoto = ifElse({
  version: 2.2,
  config: {
    name: 'Channel Photo?',
    position: [2440, 760],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr('{{ $json.tg_photo }}'), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});

const sendChannelPhoto = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Channel Photo',
    position: [2660, 680],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'message',
      operation: 'sendPhoto',
      chatId: expr('{{ $json.channel }}'),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: { caption: expr('{{ $json.telegram_html }}'), parse_mode: 'HTML', fileName: expr('{{ $json.post_id }}.jpg') }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { message_id: 5, chat: { username: 'demo' } } }]
});

const sendChannelMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Channel Message',
    position: [2660, 840],
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.channel }}'),
      text: expr('{{ $json.telegram_html }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { message_id: 6, chat: { username: 'demo' } } }]
});

const telegramResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Telegram Result',
    position: [2880, 760],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__TELEGRAM_RESULT__
    }
  },
  output: [{ platform: 'telegram', status: 'ok', url: 'https://t.me/demo/5' }]
});


const mergeResults = merge({
  version: 3.2,
  config: { name: 'All Results', position: [3760, 760], parameters: { mode: 'append', numberInputs: 2 } }
});

const summarise = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Summarise',
    position: [3980, 760],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SUMMARISE__
    }
  },
  output: [{ post_id: 'P-TEST1', status: 'posted', all_ok: true, owner_message: 'Posted', approver: '123456' }]
});

const saveResults = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Results',
    position: [4200, 760],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: { resource: 'sheet', operation: 'update', documentId: SHEET_DOC, sheetName: CAL_TAB, columns: CAL_UPDATE_COLUMNS, options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' } },
    credentials: SHEETS_CRED
  },
  output: [{ post_id: 'P-TEST1' }]
});

const allPosted = ifElse({
  version: 2.2,
  config: {
    name: 'All Posted?',
    position: [4420, 760],
    parameters: { conditions: { options: COND_OPTS, conditions: [{ leftValue: expr("{{ $('Summarise').first().json.all_ok }}"), operator: BOOL_TRUE }], combinator: 'and' } }
  }
});

const tellPosted = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Tell Owner Posted',
    position: [4640, 680],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Summarise').first().json.approver }}"),
      text: expr("{{ $('Summarise').first().json.owner_message }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const tellProblems = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Tell Owner Problems',
    position: [4640, 860],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Summarise').first().json.approver }}"),
      text: expr("{{ $('Summarise').first().json.owner_message }}"),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: { rows: [{ row: { buttons: [
        { text: '🔁 Retry', additionalFields: { callback_data: expr("rt:{{ $('Summarise').first().json.post_id }}") } }
      ] } }] },
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const noteMain = sticky(
  '## Publish Post\n' +
  'Called by the Clock when an approved post is due, and by the Telegram handler (Post now, Retry). The caller sets the row to `publishing` first.\n\n' +
  '- Only platforms with no link yet are posted, so a retry never double-posts.\n' +
  '- **Test mode** (Settings `mode = test`): sends you exactly what would go out and marks the row `test_posted`.\n' +
  '- Each platform branch always ends in one result item, so **All Results** gets exactly two.\n' +
  '- The owner gets the links, or the errors with a Retry button.',
  [], { position: [200, 120], width: 760, height: 280, color: 4 }
);

export default workflow('social-autopilot-publish', 'Social Autopilot 6: Publish Post')
  .add(whenCalled)
  .to(readSettings)
  .to(readCalendar)
  .to(readState)
  .to(preparePublish)
  .to(imageSource
    .onCase(0, downloadDrive.to(attachImage))
    .onCase(1, downloadUrl.to(attachImage))
    .onCase(2, attachImage))
  .add(downloadDrive.onError(attachImage))
  .add(downloadUrl.onError(attachImage))
  .add(attachImage)
  .to(testMode
    .onTrue(testHasImage
      .onTrue(sendTestImage.to(sendTestPosts))
      .onFalse(sendTestPosts))
    .onFalse([postLinkedIn, postTelegram]))
  .add(sendTestPosts)
  .to(testRow)
  .to(saveTest)
  .add(postLinkedIn
    .onTrue(linkedInFormat
      .onCase(0, linkedInImage.to(linkedInResult))
      .onCase(1, linkedInLink.to(linkedInResult))
      .onCase(2, linkedInText.to(linkedInResult)))
    .onFalse(linkedInResult))
  .add(linkedInImage.onError(linkedInResult))
  .add(linkedInLink.onError(linkedInResult))
  .add(linkedInText.onError(linkedInResult))
  .add(postTelegram
    .onTrue(channelPhoto
      .onTrue(sendChannelPhoto.to(telegramResult))
      .onFalse(sendChannelMessage.to(telegramResult)))
    .onFalse(telegramResult))
  .add(sendChannelPhoto.onError(telegramResult))
  .add(sendChannelMessage.onError(telegramResult))
  .add(linkedInResult)
  .to(mergeResults.input(0))
  .add(telegramResult)
  .to(mergeResults.input(1))
  .add(mergeResults)
  .to(summarise)
  .to(saveResults)
  .to(allPosted
    .onTrue(tellPosted)
    .onFalse(tellProblems))
  .add(noteMain);
