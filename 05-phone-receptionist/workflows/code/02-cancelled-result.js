const m = $("Match Appointments").first().json;
return [{
  json: {
    tool_call_id: m.tool_call_id,
    result: "Cancelled: " + m.appointment + "." + (m.late ? " It was less than 24 hours away; mention the 24-hour notice policy kindly." : "") + " Offer to book a new time.",
  },
}];
