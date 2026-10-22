// @include lib-slots.js
const p = $("Check Booking Slot").first().json;
const when = say(DateTime.fromISO(p.start, { zone: SLOT.TZ }));
return [{
  json: {
    tool_call_id: p.tool_call_id,
    event_id: $input.first().json.id ?? "",
    result: "Booked: " + p.type_label + " for " + p.patient_name + " on " + when + ". Confirmation code " + p.code +
      " (say it as: " + spell(p.code) + ")." +
      (p.is_new_patient ? " First visit: arrive 15 minutes early with photo ID and insurance card; forms will be sent beforehand." : ""),
  },
}];
