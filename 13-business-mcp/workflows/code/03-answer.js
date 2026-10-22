// What the MCP client gets back. Runs last on every path, so it is the tool's result.
return [{ json: $('Run Tool').first().json.answer }];
