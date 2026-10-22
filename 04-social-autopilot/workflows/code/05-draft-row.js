// The sheet update: the drafted row plus the ID of the preview message (used to match replies and buttons).
const a = $('Assemble Draft').first().json;
return [{ json: { ...a.row, preview_message_id: String($json.result?.message_id ?? '') } }];
