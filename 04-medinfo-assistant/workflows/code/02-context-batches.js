// One context call per 30 chunks. Every call starts with the same full document, so OpenAI's
// automatic prompt caching makes the second and later batches cheap.
const { document, chunks, doc_text } = $input.first().json;
const BATCH = 30, out = [];
for (let b = 0; b < chunks.length; b += BATCH) {
  const list = chunks.slice(b, b + BATCH)
    .map(c => `<chunk i="${c.chunk_index}" section="${String(c.section).replace(/"/g, "'")}">\n${c.content.slice(0, 1800)}\n</chunk>`)
    .join('\n');
  out.push({ json: { batch: b / BATCH, prompt: `<document file="${document.title}">\n${doc_text}\n</document>\n\n<chunks>\n${list}\n</chunks>` } });
}
return out;
