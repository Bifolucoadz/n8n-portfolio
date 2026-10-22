import { workflow, node, trigger, sticky, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8' };
const SETTINGS_TAB = { __rl: true, mode: 'id', value: '1', cachedResultName: 'Settings' };
const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const TELEGRAM_CRED = { telegramApi: { id: 'V3kTN1drqw8YNjzk', name: 'Telegram account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Check', position: [240, 400] },
  output: [{}]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [460, 400], parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'approver_chat_id', value: '123456' }]
});

const readSettings = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Settings',
    position: [680, 400],
    executeOnce: true,
    parameters: { resource: 'sheet', operation: 'read', documentId: SHEET_DOC, sheetName: SETTINGS_TAB },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, key: 'telegram_channel', value: '@demo' }]
});

const telegramChecks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Telegram Checks', position: [900, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Bot token, webhook and channel checks through the Bot API. The token never goes into the output.\n' +
        'const S = Object.fromEntries($(\'Read Settings\').all().map(i => [String(i.json.key || \'\').trim(), String(i.json.value ?? \'\').trim()]));\n' +
        'const state = Object.fromEntries($(\'Read State\').all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'const token = state.telegram_bot_token || \'\';\n' +
        'const hide = m => (token ? String(m).split(token).join(\'<token>\') : String(m));\n' +
        'const r = { token_set: !!token, approver: state.approver_chat_id || \'\', linkedin_saved: state.linkedin_person_id || \'\', mode: S.mode || \'test\' };\n' +
        '\n' +
        'let channel = String(S.telegram_channel || \'\').trim();\n' +
        'const tme = channel.match(/t\\.me\\/([\\w]+)/i);\n' +
        'if (tme) channel = \'@\' + tme[1];\n' +
        'else if (channel && !channel.startsWith(\'@\') && !/^-?\\d+$/.test(channel)) channel = \'@\' + channel;\n' +
        'r.channel = channel;\n' +
        '\n' +
        'if (token) {\n' +
        '  const api = m => \'https://api.telegram.org/bot\' + token + \'/\' + m;\n' +
        '  try {\n' +
        '    const me = await this.helpers.httpRequest({ method: \'GET\', url: api(\'getMe\'), json: true });\n' +
        '    r.bot = { id: String(me.result.id), username: me.result.username, name: me.result.first_name };\n' +
        '  } catch (e) { r.bot_error = hide(e.message); }\n' +
        '  try {\n' +
        '    const wh = await this.helpers.httpRequest({ method: \'GET\', url: api(\'getWebhookInfo\'), json: true });\n' +
        '    if (wh.result && wh.result.url) {\n' +
        '      await this.helpers.httpRequest({ method: \'POST\', url: api(\'deleteWebhook\'), body: {}, json: true });\n' +
        '      r.webhook_removed = true;\n' +
        '    }\n' +
        '  } catch (e) { r.webhook_error = hide(e.message); }\n' +
        '  if (channel && r.bot) {\n' +
        '    try {\n' +
        '      const m = await this.helpers.httpRequest({ method: \'GET\', url: api(\'getChatMember\') + \'?chat_id=\' + encodeURIComponent(channel) + \'&user_id=\' + r.bot.id, json: true });\n' +
        '      r.channel_status = m.result.status;\n' +
        '      r.channel_can_post = m.result.status === \'creator\' || m.result.can_post_messages === true;\n' +
        '    } catch (e) { r.channel_error = hide(e.message); }\n' +
        '  }\n' +
        '}\n' +
        'return [{ json: r }];\n'
  } },
  output: [{ token_set: true, approver: '123456', channel: '@demo', bot: { id: '1', username: 'demo_bot' }, channel_can_post: true }]
});

const credentialBot = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Credential Bot',
    position: [1120, 400],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.approver }}'),
      text: '🔧 Checking Social Autopilot connections…',
      additionalFields: { appendAttribution: false }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true, result: { from: { id: 1, username: 'demo_bot' } } }]
});

const linkedInProfile = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'LinkedIn Profile',
    position: [1340, 400],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://api.linkedin.com/v2/userinfo',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'linkedInOAuth2Api',
      options: { timeout: 20000 }
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn account') }
  },
  output: [{ sub: 'abc123', name: 'Samuel Oladele' }]
});

const report = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Report', position: [1780, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One line per connection, plus the LinkedIn member ID that Publish Post needs.\n' +
        'const t = $(\'Telegram Checks\').first().json;\n' +
        'const cred = $(\'Credential Bot\').first().json;\n' +
        'const li = $(\'LinkedIn Profile\').first().json;\n' +
        'const esc = s => String(s ?? \'\').replace(/&/g, \'&amp;\').replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\');\n' +
        'const err = j => esc(String(j.error?.message || j.error || j.message || \'unknown error\').slice(0, 200));\n' +
        'const L = [\'🔧 <b>Social Autopilot connection check</b>\', \'\'];\n' +
        'let good = true;\n' +
        'const line = (okay, text) => { if (!okay) good = false; L.push((okay ? \'✅ \' : \'❌ \') + text); };\n' +
        '\n' +
        'line(true, \'Google Sheet: calendar and settings read\');\n' +
        'line(t.token_set, t.token_set ? \'Bot token is in the data table\' : \'Bot token missing: put it in the data table <b>Social Autopilot State</b>, row <code>telegram_bot_token</code>\');\n' +
        'if (t.token_set) line(!!t.bot, t.bot ? \'Bot: @\' + esc(t.bot.username) : \'Bot token rejected by Telegram: \' + esc(t.bot_error));\n' +
        'if (t.webhook_removed) L.push(\'ℹ️ An old webhook was removed so the Listener can receive updates.\');\n' +
        'line(!!t.approver, t.approver ? \'Approver chat: \' + esc(t.approver) : \'No approver yet: publish the Listener, then send /start to the bot\');\n' +
        'const credBot = cred.result && cred.result.from ? String(cred.result.from.id) : \'\';\n' +
        'if (t.approver) line(!!credBot && (!t.bot || credBot === t.bot.id), credBot ? (t.bot && credBot !== t.bot.id ? \'The n8n Telegram credential is a different bot (@\' + esc(cred.result.from.username) + \') from the token. Use the same bot for both.\' : \'n8n Telegram credential sends as the same bot\') : \'n8n Telegram credential could not send: \' + err(cred));\n' +
        'if (t.channel) line(!!t.channel_can_post, t.channel_can_post ? \'Channel \' + esc(t.channel) + \': bot can post\' : \'Channel \' + esc(t.channel) + \': \' + (t.channel_error ? esc(t.channel_error) : \'bot is \' + esc(t.channel_status || \'not a member\') + \', make it an admin with "Post messages"\'));\n' +
        'else line(false, \'No <code>telegram_channel</code> in Settings\');\n' +
        'const sub = li.sub ? String(li.sub) : \'\';\n' +
        'line(!!sub, sub ? \'LinkedIn: \' + esc(li.name || li.given_name || \'connected\') : \'LinkedIn: \' + err(li));\n' +
        'L.push(\'\');\n' +
        'L.push(\'Mode: <b>\' + esc(t.mode) + \'</b>\' + (/^live$/i.test(t.mode) ? \'\' : \' (posts are sent to you instead of going public)\'));\n' +
        'L.push(good ? \'Everything is connected.\' : \'Fix the ❌ items and run this check again.\');\n' +
        'return [{ json: { report: L.join(\'\\n\'), all_ok: good, linkedin_sub: sub, approver: t.approver } }];\n'
  } },
  output: [{ report: 'All good', all_ok: true, linkedin_sub: 'abc123', approver: '123456' }]
});

const hasLinkedIn = ifElse({
  version: 2.2,
  config: { name: 'LinkedIn Connected?', position: [2000, 300], parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.linkedin_sub }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } } }
});

const saveLinkedIn = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save LinkedIn Member ID',
    position: [2220, 300],
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: STATE_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'linkedin_person_id' }] },
      columns: { mappingMode: 'defineBelow', value: { key: 'linkedin_person_id', value: expr('{{ $json.linkedin_sub }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'linkedin_person_id', value: 'abc123' }]
});

const sendReport = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Report',
    position: [2000, 500],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Report').first().json.approver }}"),
      text: expr("{{ $('Report').first().json.report }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    credentials: TELEGRAM_CRED
  },
  output: [{ ok: true }]
});

const note = sticky(
  '## Check Connections (run by hand)\n' +
  'Run after setup and whenever something stops posting. Checks the bot token (and removes any old webhook), the approver, that the n8n Telegram credential is the same bot, the bot\'s admin rights in the channel, and LinkedIn.\n\n' +
  'It also saves your LinkedIn member ID to the data table, which **Publish Post** needs. The result is in the **Report** node and sent to you in Telegram.',
  [], { position: [200, 120], width: 760, height: 220, color: 4 }
);

export default workflow('social-autopilot-check', 'Social Autopilot 8: Check Connections')
  .add(start)
  .to(readState)
  .to(readSettings)
  .to(telegramChecks)
  .to(credentialBot)
  .to(linkedInProfile)
  .to(report)
  .to(hasLinkedIn.onTrue(saveLinkedIn))
  .add(report.to(sendReport))
  .add(note);
