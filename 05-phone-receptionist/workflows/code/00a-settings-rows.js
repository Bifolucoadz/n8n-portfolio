return [
  { json: { key: "calendar_id", value: $("Create Calendar").first().json.id } },
  { json: { key: "sheet_id", value: $("Create Sheet").first().json.spreadsheetId } },
  { json: { key: "webhook_secret", value: $("Generate Secret").first().json.data } },
  { json: { key: "staff_chat_id", value: $("Plan").first().json.staff_chat_id } },
];
