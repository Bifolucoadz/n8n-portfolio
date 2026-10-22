// Attach each embedding to its chunk. The payload goes to kb_index_document as one JSON parameter.
const prep = $('Assemble Chunks').first().json;
const data = $input.first().json.data ?? [];
if (data.length !== prep.chunks.length) throw new Error(`Got ${data.length} embeddings for ${prep.chunks.length} chunks`);
const byIndex = {};
for (const d of data) byIndex[d.index] = d.embedding;
const chunks = prep.chunks.map((c, i) => ({
  chunk_index: c.chunk_index, section: c.section, page: c.page, content: c.content, context: c.context, embedding: byIndex[i],
}));
return [{ json: { payload: JSON.stringify({ document: prep.document, chunks }) } }];
