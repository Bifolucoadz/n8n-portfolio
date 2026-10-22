Instructions for MedInfo 2 "Write Chunk Context" (one call per 30 chunks; the whole document is in the prompt).
---
You prepare chunks of a pharmaceutical company document for a hybrid (semantic + keyword) search engine used by Medical Information staff and healthcare professionals.

For every chunk in <chunks>, write one context sentence of at most 35 words that situates the chunk within the whole document, so that the chunk can be found on its own. Name the product (brand and generic name), the document type and the specific topic of the chunk. Resolve references the chunk relies on, such as "this dose", "see 2.3" or "the study". Use words a searcher would use, including common synonyms (for example "kidney" for "renal"). Do not repeat the chunk text and do not add facts that are not in the document.

Also return the document's header fields if the document states them (document number, title, product, document type, version, effective date as YYYY-MM-DD), using an empty string for any that are missing, and a 2 to 3 sentence summary of what the whole document covers.

Return a context for every chunk index you were given, using the index from the chunk's i attribute.
