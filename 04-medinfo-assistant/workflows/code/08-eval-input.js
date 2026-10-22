// One test question, from the Evaluation Trigger or from the Data Table (manual run).
const r = $json;
return {
  json: {
    qid: String(r.qid ?? ''),
    role: String(r.role || 'hcp'),
    question: String(r.question ?? ''),
    expected_answer: String(r.expected_answer ?? ''),
    expected_route: String(r.expected_route ?? ''),
    expected_doc: String(r.expected_doc ?? ''),
    must_not_cite: String(r.must_not_cite ?? ''),
    // A fresh session per question and run, so no question sees another's history.
    session_id: `eval-${r.qid}-${$execution.id}`,
  },
};
