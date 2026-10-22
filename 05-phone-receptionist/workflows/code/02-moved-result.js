// @include lib-slots.js
const p = $("Check Move Slot").first().json;
return [{
  json: {
    tool_call_id: p.tool_call_id,
    result: "Moved: " + p.type_label + " for " + p.name + " is now on " + say(DateTime.fromISO(p.start, { zone: SLOT.TZ })) +
      " (was " + say(DateTime.fromISO(p.old_start, { zone: SLOT.TZ })) + "). Same confirmation code " + p.code + ".",
  },
}];
