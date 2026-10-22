const c = $("Config").first().json;
return [{ json: { tool_call_id: c.tool_call_id, result: "That action isn't available. Offer to take a message for the front desk." } }];
