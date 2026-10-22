// Poll only once the bot token is in the data table. The token itself stays out of the item data.
const state = Object.fromEntries($input.all().map(i => [String(i.json.key), String(i.json.value ?? '')]));
if (!state.telegram_bot_token) return [];
return [{ json: { offset: Number(state.telegram_offset) || 0 } }];
