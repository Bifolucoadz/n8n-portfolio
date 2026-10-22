// Normalise the tool call coming from Receptionist 1 (one call per execution).
const c = $input.first().json;
let args = c.args ?? {};
if (typeof args === "string") { try { args = JSON.parse(args); } catch (e) { args = {}; } }
return [{ json: { ...c, args, name: String(c.name ?? "").trim() } }];
