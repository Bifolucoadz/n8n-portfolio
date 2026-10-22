// One row per tool call: when, which server, which tool, the arguments, whether it worked, and how long it took.
return $input.all().map(i => ({ json: i.json.audit }));
