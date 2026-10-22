// One result item for the Telegram channel: ok with the post link, error, or skipped.
const p = $('Attach Image').first().json;
if (!p.need_tg) return [{ json: { platform: 'telegram', status: 'skipped' } }];
const j = $json;
if (!p.channel) return [{ json: { platform: 'telegram', status: 'error', error: 'No telegram_channel in Settings.' } }];
if (j.result && j.result.message_id) {
  const user = j.result.chat && j.result.chat.username;
  const url = user ? 'https://t.me/' + user + '/' + j.result.message_id : 'message ' + j.result.message_id + ' in ' + p.channel;
  return [{ json: { platform: 'telegram', status: 'ok', url } }];
}
return [{ json: { platform: 'telegram', status: 'error', error: String(j.error?.message || j.error || j.description || 'Telegram returned no message') } }];
