// Bot token, webhook and channel checks through the Bot API. The token never goes into the output.
const S = Object.fromEntries($('Read Settings').all().map(i => [String(i.json.key || '').trim(), String(i.json.value ?? '').trim()]));
const state = Object.fromEntries($('Read State').all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
const token = state.telegram_bot_token || '';
const hide = m => (token ? String(m).split(token).join('<token>') : String(m));
const r = { token_set: !!token, approver: state.approver_chat_id || '', linkedin_saved: state.linkedin_person_id || '', mode: S.mode || 'test' };

let channel = String(S.telegram_channel || '').trim();
const tme = channel.match(/t\.me\/([\w]+)/i);
if (tme) channel = '@' + tme[1];
else if (channel && !channel.startsWith('@') && !/^-?\d+$/.test(channel)) channel = '@' + channel;
r.channel = channel;

if (token) {
  const api = m => 'https://api.telegram.org/bot' + token + '/' + m;
  try {
    const me = await this.helpers.httpRequest({ method: 'GET', url: api('getMe'), json: true });
    r.bot = { id: String(me.result.id), username: me.result.username, name: me.result.first_name };
  } catch (e) { r.bot_error = hide(e.message); }
  try {
    const wh = await this.helpers.httpRequest({ method: 'GET', url: api('getWebhookInfo'), json: true });
    if (wh.result && wh.result.url) {
      await this.helpers.httpRequest({ method: 'POST', url: api('deleteWebhook'), body: {}, json: true });
      r.webhook_removed = true;
    }
  } catch (e) { r.webhook_error = hide(e.message); }
  if (channel && r.bot) {
    try {
      const m = await this.helpers.httpRequest({ method: 'GET', url: api('getChatMember') + '?chat_id=' + encodeURIComponent(channel) + '&user_id=' + r.bot.id, json: true });
      r.channel_status = m.result.status;
      r.channel_can_post = m.result.status === 'creator' || m.result.can_post_messages === true;
    } catch (e) { r.channel_error = hide(e.message); }
  }
}
return [{ json: r }];
