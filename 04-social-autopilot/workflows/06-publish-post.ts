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
          { id: 'post_id', displayName: 'post_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'publish_at', displayName: 'publish_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'topic', displayName: 'topic', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'link', displayName: 'link', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image', displayName: 'image', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'platforms', displayName: 'platforms', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_text', displayName: 'linkedin_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'telegram_text', displayName: 'telegram_text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image_link', displayName: 'image_link', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'linkedin_url', displayName: 'linkedin_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'telegram_url', displayName: 'telegram_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'error', displayName: 'error', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'drafted_at', displayName: 'drafted_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'approved_at', displayName: 'approved_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'posted_at', displayName: 'posted_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'feedback', displayName: 'feedback', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'image_file_id', displayName: 'image_file_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'preview_message_id', displayName: 'preview_message_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reminded_at', displayName: 'reminded_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'attempts', displayName: 'attempts', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
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
        '// The row to publish and what still has to go out. The caller sets it to publishing first.\n' +
        'const postId = String($(\'When Called\').first().json.post_id || \'\').trim();\n' +
        'const S = Object.fromEntries($(\'Read Settings\').all().map(i => [String(i.json.key || \'\').trim(), String(i.json.value ?? \'\').trim()]));\n' +
        'const state = Object.fromEntries($(\'Read State\').all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'const row = $(\'Read Calendar\').all().map(i => i.json).find(r => String(r.post_id || \'\').trim() === postId);\n' +
        'if (!row) throw new Error(\'No calendar row with post_id \' + postId);\n' +
        'if (String(row.status || \'\').trim() !== \'publishing\') return [];\n' +
        '\n' +
        'function platformList(v) {\n' +
        '  const alias = { linkedin: \'linkedin\', li: \'linkedin\', \'linked in\': \'linkedin\', telegram: \'telegram\', tg: \'telegram\' };\n' +
        '  const out = [];\n' +
        '  for (const p of String(v || \'\').toLowerCase().split(/[,;/]+/)) {\n' +
        '    const k = alias[p.trim()];\n' +
        '    if (k && !out.includes(k)) out.push(k);\n' +
        '  }\n' +
        '  return out;\n' +
        '}\n' +
        'let platforms = platformList(row.platforms);\n' +
        'if (!platforms.length) platforms = platformList(S.default_platforms || \'linkedin, telegram\');\n' +
        '// A platform that already has a link was posted on an earlier try; never post it twice.\n' +
        'const urlCol = { linkedin: \'linkedin_url\', telegram: \'telegram_url\' };\n' +
        'const needs = platforms.filter(p => !String(row[urlCol[p]] || \'\').trim());\n' +
        '\n' +
        'const imageCell = String(row.image || S.default_image || \'none\').trim();\n' +
        'let image = { mode: \'none\' };\n' +
        'if (!/^none$/i.test(imageCell) && imageCell !== \'\') {\n' +
        '  if (row.image_file_id) image = { mode: \'drive\', file_id: String(row.image_file_id) };\n' +
        '  else if (/^https?:\\/\\//i.test(imageCell)) {\n' +
        '    const m = imageCell.match(/drive\\.google\\.com\\/(?:file\\/d\\/|open\\?id=|uc\\?(?:export=\\w+&)?id=)([\\w-]{20,})/);\n' +
        '    image = m ? { mode: \'drive\', file_id: m[1] } : { mode: \'url\', url: imageCell };\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        'let channel = String(S.telegram_channel || \'\').trim();\n' +
        'const tme = channel.match(/t\\.me\\/([\\w]+)/i);\n' +
        'if (tme) channel = \'@\' + tme[1];\n' +
        'else if (channel && !channel.startsWith(\'@\') && !/^-?\\d+$/.test(channel)) channel = \'@\' + channel;\n' +
        '\n' +
        'const tz = S.timezone || \'Africa/Lagos\';\n' +
        'return [{ json: {\n' +
        '  post_id: postId,\n' +
        '  topic: String(row.topic || \'\').trim(),\n' +
        '  linkedin_text: String(row.linkedin_text || \'\').trim(),\n' +
        '  telegram_text: String(row.telegram_text || \'\').trim(),\n' +
        '  link: String(row.link || S.default_link || \'\').trim(),\n' +
        '  platforms,\n' +
        '  needs,\n' +
        '  need_li: needs.includes(\'linkedin\'),\n' +
        '  need_tg: needs.includes(\'telegram\'),\n' +
        '  already: platforms.filter(p => !needs.includes(p)),\n' +
        '  image,\n' +
        '  image_alt: \'Illustration for: \' + String(row.topic || \'\').trim(),\n' +
        '  test_mode: !/^live$/i.test(S.mode || \'test\'),\n' +
        '  approver: state.approver_chat_id || \'\',\n' +
        '  channel,\n' +
        '  linkedin_person: state.linkedin_person_id || \'\',\n' +
        '  visibility: /^connections$/i.test(S.linkedin_visibility || \'\') ? \'CONNECTIONS\' : \'PUBLIC\',\n' +
        '  attempts: Number(row.attempts) || 0,\n' +
        '  now_text: DateTime.now().setZone(tz).toFormat(\'yyyy-MM-dd HH:mm\')\n' +
        '} }];\n'
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
        '// The post plus its image (if it loaded), the link card for link-only posts, and the test-mode message.\n' +
        'const p = $(\'Prepare Publish\').first().json;\n' +
        'const item = $input.first();\n' +
        'const has = !!(item.binary && item.binary.data);\n' +
        'const bytes = has ? Number(item.binary.data.bytes || 0) : 0;\n' +
        'const notes = [];\n' +
        'if (p.image.mode !== \'none\' && !has) {\n' +
        '  notes.push(\'The image could not be loaded (\' + String(item.json.error?.message || item.json.error || \'no data\') + \'), so it went out as text.\');\n' +
        '}\n' +
        '\n' +
        '// Link-only LinkedIn posts get an article card: read the page\'s title and description.\n' +
        'let card = null;\n' +
        'if (p.link && !has) {\n' +
        '  card = { title: p.topic, description: \'\' };\n' +
        '  try {\n' +
        '    const html = String(await this.helpers.httpRequest({ method: \'GET\', url: p.link, timeout: 15000, headers: { \'User-Agent\': \'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36\' } }));\n' +
        '    const meta = names => {\n' +
        '      for (const tag of html.match(/<meta\\b[^>]*>/gi) || []) {\n' +
        '        const a = {};\n' +
        '        for (const m of tag.matchAll(/([\\w:-]+)\\s*=\\s*("([^"]*)"|\'([^\']*)\')/g)) a[m[1].toLowerCase()] = m[3] ?? m[4];\n' +
        '        if (names.includes((a.property || a.name || \'\').toLowerCase()) && a.content) return a.content.trim();\n' +
        '      }\n' +
        '      return \'\';\n' +
        '    };\n' +
        '    const t = meta([\'og:title\', \'twitter:title\']) || ((html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i) || [])[1] || \'\').trim();\n' +
        '    if (t) card.title = t.slice(0, 200);\n' +
        '    card.description = meta([\'og:description\', \'description\', \'twitter:description\']).slice(0, 300);\n' +
        '  } catch (e) {\n' +
        '    // the card falls back to the topic as its title\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        'const esc = s => String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        'const cut = (s, n) => (s.length > n ? s.slice(0, n) + \'…\' : s);\n' +
        'const parts = [\'🧪 <b>Test mode</b> · <code>\' + p.post_id + \'</code> would have been posted now:\'];\n' +
        'if (p.need_li) parts.push(\'<b>LinkedIn</b>\' + (has ? \' (with the image above)\' : p.link ? \' (with a link card)\' : \'\') + \'\\n\' + esc(cut(p.linkedin_text, 1500)));\n' +
        'if (p.need_tg) parts.push(\'<b>Telegram \' + esc(p.channel || \'(no channel set)\') + \'</b>\\n\' + esc(cut(p.telegram_text, 1200)));\n' +
        'if (!p.needs.length) parts.push(\'Nothing left to post: every platform already has a link.\');\n' +
        'for (const n of notes) parts.push(\'⚠️ \' + esc(n));\n' +
        'parts.push(\'Set <code>mode</code> to <code>live</code> in the Settings tab to post for real.\');\n' +
        '\n' +
        'const out = { json: {\n' +
        '  ...p,\n' +
        '  has_image: has,\n' +
        '  image_bytes: bytes,\n' +
        '  tg_photo: has && p.telegram_text.length <= 1024,\n' +
        '  telegram_html: esc(p.telegram_text),\n' +
        '  card,\n' +
        '  notes,\n' +
        '  test_message: parts.join(\'\\n\\n\').slice(0, 4090)\n' +
        '} };\n' +
        'if (has) out.binary = { data: item.binary.data };\n' +
        'return [out];\n'
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
        '// Test mode: mark the row as test_posted. Link columns stay empty so a later live run still posts everywhere.\n' +
        'const p = $(\'Attach Image\').first().json;\n' +
        'return [{ json: { post_id: p.post_id, status: \'test_posted\', posted_at: p.now_text, error: p.notes.join(\' \'), attempts: \'0\', updated_at: p.now_text } }];\n'
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
        '// One result item for LinkedIn: ok with the post link, error, or skipped.\n' +
        'const p = $(\'Attach Image\').first().json;\n' +
        'if (!p.need_li) return [{ json: { platform: \'linkedin\', status: \'skipped\' } }];\n' +
        'const j = $json;\n' +
        'if (j.urn) return [{ json: { platform: \'linkedin\', status: \'ok\', url: \'https://www.linkedin.com/feed/update/\' + j.urn + \'/\' } }];\n' +
        'let error = String(j.error?.message || j.error || j.message || \'LinkedIn returned no post ID\');\n' +
        'if (!p.linkedin_person) error = \'LinkedIn is not connected yet (run Social Autopilot 8: Check Connections). \' + error;\n' +
        'return [{ json: { platform: \'linkedin\', status: \'error\', error } }];\n'
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
        '// One result item for the Telegram channel: ok with the post link, error, or skipped.\n' +
        'const p = $(\'Attach Image\').first().json;\n' +
        'if (!p.need_tg) return [{ json: { platform: \'telegram\', status: \'skipped\' } }];\n' +
        'const j = $json;\n' +
        'if (!p.channel) return [{ json: { platform: \'telegram\', status: \'error\', error: \'No telegram_channel in Settings.\' } }];\n' +
        'if (j.result && j.result.message_id) {\n' +
        '  const user = j.result.chat && j.result.chat.username;\n' +
        '  const url = user ? \'https://t.me/\' + user + \'/\' + j.result.message_id : \'message \' + j.result.message_id + \' in \' + p.channel;\n' +
        '  return [{ json: { platform: \'telegram\', status: \'ok\', url } }];\n' +
        '}\n' +
        'return [{ json: { platform: \'telegram\', status: \'error\', error: String(j.error?.message || j.error || j.description || \'Telegram returned no message\') } }];\n'
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
        '// Combine the two results into the sheet update and the message for the owner.\n' +
        'const p = $(\'Attach Image\').first().json;\n' +
        'const results = $input.all().map(i => i.json).filter(r => r.platform);\n' +
        'const label = { linkedin: \'LinkedIn\', telegram: \'Telegram\' };\n' +
        'const esc = s => String(s).replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        '\n' +
        'const row = { post_id: p.post_id, updated_at: p.now_text };\n' +
        'const ok = results.filter(r => r.status === \'ok\');\n' +
        'const failed = results.filter(r => r.status === \'error\');\n' +
        'for (const r of ok) row[r.platform + \'_url\'] = r.url;\n' +
        'const done = ok.length + p.already.length;\n' +
        'row.status = failed.length === 0 ? \'posted\' : done > 0 ? \'partial\' : \'failed\';\n' +
        'if (ok.length) row.posted_at = p.now_text;\n' +
        'const problems = failed.map(f => label[f.platform] + \': \' + f.error);\n' +
        'const notes = [...p.notes, ...ok.filter(r => r.note).map(r => label[r.platform] + \': \' + r.note)];\n' +
        'row.error = [...problems, ...notes].join(\' | \');\n' +
        'row.attempts = failed.length ? String(p.attempts + 1) : \'0\';\n' +
        '\n' +
        'const lines = [];\n' +
        'if (!failed.length) lines.push(\'✅ <b>Posted</b> · <code>\' + p.post_id + \'</code>\');\n' +
        'else lines.push((ok.length ? \'⚠️ <b>Partly posted</b>\' : \'❌ <b>Not posted</b>\') + \' · <code>\' + p.post_id + \'</code>\');\n' +
        'lines.push(\'<i>\' + esc(p.topic) + \'</i>\');\n' +
        'for (const r of ok) lines.push(label[r.platform] + \': \' + (/^https?:/.test(r.url) ? \'<a href="\' + esc(r.url) + \'">open post</a>\' : esc(r.url)));\n' +
        'for (const r of failed) lines.push(label[r.platform] + \' failed: \' + esc(r.error.slice(0, 300)));\n' +
        'for (const n of notes) lines.push(\'⚠️ \' + esc(n));\n' +
        'if (failed.length) lines.push(\'Fix the problem, then tap Retry. Platforms that already worked are not posted again.\');\n' +
        '\n' +
        'return [{ json: { ...row, all_ok: failed.length === 0, owner_message: lines.join(\'\\n\'), approver: p.approver } }];\n'
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
