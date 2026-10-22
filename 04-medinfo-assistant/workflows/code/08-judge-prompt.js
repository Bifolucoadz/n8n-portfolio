// The judge sees the question, the expected answer, the assistant's answer and the exact passages
// it cited, numbered as in the answer.
const row = $('Eval Input').item.json;
const ans = $('Answer').item.json;
const byId = Object.fromEntries(($json.passages ?? []).map(p => [p.id, p.text]));
const cited = (ans.sources ?? []).map(s => `[${s.n}] ${s.doc_code} v${s.version} (${s.status}), ${s.section}\n${byId[s.id] ?? '(text not found)'}`);
return {
  json: {
    prompt:
      `<question role="${row.role}">\n${row.question}\n</question>\n` +
      `<expected_answer>\n${row.expected_answer}\n</expected_answer>\n` +
      `<assistant_answer route="${ans.route ?? 'error'}">\n${ans.answer ?? '(no answer)'}\n</assistant_answer>\n` +
      `<cited_passages>\n${cited.join('\n\n') || '(none)'}\n</cited_passages>`,
  },
};
