const r = $("Compose Reply").first().json;
return [{ json: { reply: r.body, kind: r.kind, url: r.url, button_text: r.button_text } }];
