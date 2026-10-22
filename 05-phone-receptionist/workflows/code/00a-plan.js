// One-off: refuses to run twice so it can't create a second calendar or sheet.
const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
if (s.calendar_id || s.sheet_id) throw new Error("Setup already ran (calendar_id / sheet_id are set in Receptionist Settings). Clear them first to start over.");
const autopilot = Object.fromEntries($("Read Autopilot State").all().map(i => [i.json.key, i.json.value ?? ""]));
// Staff alerts go to the same Telegram chat as Social Autopilot's approver unless set already.
return [{ json: { staff_chat_id: s.staff_chat_id || autopilot.approver_chat_id || "" } }];
