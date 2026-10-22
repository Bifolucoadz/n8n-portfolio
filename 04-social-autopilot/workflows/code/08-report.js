// One line per connection, plus the LinkedIn member ID that Publish Post needs.
const t = $('Telegram Checks').first().json;
const cred = $('Credential Bot').first().json;
const li = $('LinkedIn Profile').first().json;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const err = j => esc(String(j.error?.message || j.error || j.message || 'unknown error').slice(0, 200));
const L = ['🔧 <b>Social Autopilot connection check</b>', ''];
let good = true;
const line = (okay, text) => { if (!okay) good = false; L.push((okay ? '✅ ' : '❌ ') + text); };

line(true, 'Google Sheet: calendar and settings read');
line(t.token_set, t.token_set ? 'Bot token is in the data table' : 'Bot token missing: put it in the data table <b>Social Autopilot State</b>, row <code>telegram_bot_token</code>');
if (t.token_set) line(!!t.bot, t.bot ? 'Bot: @' + esc(t.bot.username) : 'Bot token rejected by Telegram: ' + esc(t.bot_error));
if (t.webhook_removed) L.push('ℹ️ An old webhook was removed so the Listener can receive updates.');
line(!!t.approver, t.approver ? 'Approver chat: ' + esc(t.approver) : 'No approver yet: publish the Listener, then send /start to the bot');
const credBot = cred.result && cred.result.from ? String(cred.result.from.id) : '';
if (t.approver) line(!!credBot && (!t.bot || credBot === t.bot.id), credBot ? (t.bot && credBot !== t.bot.id ? 'The n8n Telegram credential is a different bot (@' + esc(cred.result.from.username) + ') from the token. Use the same bot for both.' : 'n8n Telegram credential sends as the same bot') : 'n8n Telegram credential could not send: ' + err(cred));
if (t.channel) line(!!t.channel_can_post, t.channel_can_post ? 'Channel ' + esc(t.channel) + ': bot can post' : 'Channel ' + esc(t.channel) + ': ' + (t.channel_error ? esc(t.channel_error) : 'bot is ' + esc(t.channel_status || 'not a member') + ', make it an admin with "Post messages"'));
else line(false, 'No <code>telegram_channel</code> in Settings');
const sub = li.sub ? String(li.sub) : '';
line(!!sub, sub ? 'LinkedIn: ' + esc(li.name || li.given_name || 'connected') : 'LinkedIn: ' + err(li));
L.push('');
L.push('Mode: <b>' + esc(t.mode) + '</b>' + (/^live$/i.test(t.mode) ? '' : ' (posts are sent to you instead of going public)'));
L.push(good ? 'Everything is connected.' : 'Fix the ❌ items and run this check again.');
return [{ json: { report: L.join('\n'), all_ok: good, linkedin_sub: sub, approver: t.approver } }];
