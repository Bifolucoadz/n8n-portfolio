// One-off: refuses to run twice so it can't create a second kitchen board.
const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
if (s.kitchen_sheet_id) throw new Error("Setup already ran (kitchen_sheet_id is set in Honeycrumb Settings). Clear it first to start over.");
const autopilot = Object.fromEntries($("Read Autopilot State").all().map(i => [i.json.key, i.json.value ?? ""]));
return [{ json: { owner_chat_id: s.owner_chat_id || autopilot.approver_chat_id || "" } }];
