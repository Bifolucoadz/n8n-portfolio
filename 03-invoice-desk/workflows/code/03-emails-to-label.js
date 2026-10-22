// Label each email once, however many attachments it had.
const ids = [...new Set($('Split Attachments').all().map(i => i.json.message_id).filter(Boolean))];
return ids.map(message_id => ({ json: { message_id } }));
