const m = $("Prepare Message").first().json;
return [{
  json: {
    tool_call_id: m.tool_call_id,
    result: m.ok
      ? "Message passed to the front desk" + (m.urgent ? " as urgent: they call back within two hours during opening hours." : ": they call back within one business day.")
      : "Message not sent yet: still need " + m.missing + ". Ask for it, then call take_message again.",
  },
}];
