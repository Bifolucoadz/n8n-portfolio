import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const STATE_TABLE = { __rl: true, mode: 'id', value: 'PDrCjnORTqy1EDhP', cachedResultName: 'Social Autopilot State' };
const HANDLER_WF = { __rl: true, mode: 'id', value: 'Ct82LJwhDk3wIS1M', cachedResultName: 'Social Autopilot 4: Handle Telegram Update' };

const everyMinute = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Every Minute', position: [240, 400], parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } },
  output: [{}]
});

const readState = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Read State', position: [460, 400], parameters: { resource: 'row', operation: 'get', dataTableId: STATE_TABLE, returnAll: true } },
  output: [{ key: 'telegram_offset', value: '0' }]
});

const pollSettings = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Poll Settings', position: [680, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// Poll only once the bot token is in the data table. The token itself stays out of the item data.\n' +
        'const state = Object.fromEntries($input.all().map(i => [String(i.json.key), String(i.json.value ?? \'\')]));\n' +
        'if (!state.telegram_bot_token) return [];\n' +
        'return [{ json: { offset: Number(state.telegram_offset) || 0 } }];\n'
  } },
  output: [{ offset: 0 }]
});

const getUpdates = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Updates',
    position: [900, 400],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr("https://api.telegram.org/bot{{ $('Read State').all().find(i => i.json.key === 'telegram_bot_token').json.value }}/getUpdates"),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ { offset: $json.offset, timeout: 50, allowed_updates: ['message', 'callback_query'] } }}"),
      options: { timeout: 65000 }
    }
  },
  output: [{ ok: true, result: [] }]
});

const splitUpdates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Split Updates', position: [1120, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// One item per Telegram update, reduced to what the handler needs, plus the next offset to confirm them.\n' +
        'const res = $json;\n' +
        'const updates = Array.isArray(res.result) ? res.result : [];\n' +
        'if (!updates.length) return [];\n' +
        'const next = Math.max(...updates.map(u => Number(u.update_id) || 0)) + 1;\n' +
        'const out = [];\n' +
        'for (const u of updates) {\n' +
        '  const cb = u.callback_query;\n' +
        '  const msg = cb ? cb.message : u.message;\n' +
        '  if (!msg && !cb) continue;\n' +
        '  const from = cb ? cb.from : msg.from || {};\n' +
        '  out.push({ json: {\n' +
        '    update_id: u.update_id,\n' +
        '    next_offset: String(next),\n' +
        '    kind: cb ? \'callback\' : \'message\',\n' +
        '    from_id: String(from.id || \'\'),\n' +
        '    first_name: from.first_name || \'\',\n' +
        '    chat_id: String((msg && msg.chat && msg.chat.id) || from.id || \'\'),\n' +
        '    chat_type: (msg && msg.chat && msg.chat.type) || \'\',\n' +
        '    message_id: msg ? msg.message_id : 0,\n' +
        '    reply_to_id: (!cb && msg && msg.reply_to_message) ? msg.reply_to_message.message_id : 0,\n' +
        '    text: (!cb && msg) ? String(msg.text || msg.caption || \'\') : \'\',\n' +
        '    data: cb ? String(cb.data || \'\') : \'\',\n' +
        '    callback_id: cb ? String(cb.id) : \'\'\n' +
        '  } });\n' +
        '}\n' +
        '// Updates nobody handles (e.g. channel posts) are still confirmed through next_offset.\n' +
        'if (!out.length) out.push({ json: { next_offset: String(next), kind: \'none\' } });\n' +
        'return out;\n'
  } },
  output: [{ update_id: 1, next_offset: '2', kind: 'message', from_id: '123456', chat_id: '123456', chat_type: 'private', message_id: 5, reply_to_id: 0, text: '/start', data: '', callback_id: '' }]
});

const saveOffset = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Offset',
    position: [1340, 260],
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: STATE_TABLE,
      filters: { conditions: [{ keyName: 'key', condition: 'eq', keyValue: 'telegram_offset' }] },
      columns: { mappingMode: 'defineBelow', value: { key: 'telegram_offset', value: expr('{{ $json.next_offset }}') }, schema: [
        { id: 'key', displayName: 'key', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false },
        { id: 'value', displayName: 'value', required: false, defaultMatch: false, display: true, type: 'string', readOnly: false, removed: false }
      ] }
    }
  },
  output: [{ key: 'telegram_offset', value: '2' }]
});

const isReal = ifElse({
  version: 2.2,
  config: {
    name: 'Something To Handle?',
    position: [1340, 480],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.kind }}'), operator: { type: 'string', operation: 'notEquals' }, rightValue: 'none' }], combinator: 'and' } }
  }
});

const handle = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Handle Each Update',
    position: [1560, 460],
    parameters: { mode: 'each', source: 'database', workflowId: HANDLER_WF, options: { waitForSubWorkflow: false } }
  },
  output: [{}]
});

const note = sticky(
  '## Telegram Listener\n' +
  'n8n runs on a Mac without a public address, so Telegram can\'t push updates to a webhook. Instead this asks Telegram every minute (`getUpdates` long poll: the call waits up to 50 s and returns the moment you tap a button).\n\n' +
  '- The bot token lives in the data table **Social Autopilot State** (`telegram_bot_token`), not in the workflow.\n' +
  '- The offset is saved first, so each update is handled once.\n' +
  '- Each update starts **Social Autopilot 4** without waiting.\n' +
  '- Successful runs are not saved (1,440 a day); failed runs are.',
  [], { position: [200, 40], width: 760, height: 300, color: 4 }
);

export default workflow('social-autopilot-listener', 'Social Autopilot 3: Telegram Listener')
  .add(everyMinute)
  .to(readState)
  .to(pollSettings)
  .to(getUpdates)
  .to(splitUpdates)
  .to(saveOffset)
  .add(splitUpdates.to(isReal.onTrue(handle)))
  .add(note);
