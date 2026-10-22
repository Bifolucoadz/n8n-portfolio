return [
  { json: { key: "kitchen_sheet_id", value: $("Create Kitchen Board").first().json.spreadsheetId } },
  { json: { key: "owner_chat_id", value: $("Plan").first().json.owner_chat_id } },
];
