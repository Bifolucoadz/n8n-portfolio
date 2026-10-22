import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'KuHYFOV4eYWj9L5O', name: 'Postgres account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Database Setup', position: [240, 300] },
  output: [{}]
});

const runSql = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Create Tables and Functions',
    position: [520, 300],
    parameters: {
      operation: 'executeQuery',
      query:
        '-- MedInfo Assistant (portfolio project 4). Run by "MedInfo 0a: Database Setup" through the\n' +
        '-- Postgres credential; safe to run again. Every function takes one jsonb argument and returns\n' +
        '-- jsonb, so n8n passes a single JSON query parameter.\n' +
        '-- Keep dollar-digit placeholders out of this file: n8n\'s Postgres node would try to fill them.\n' +
        '\n' +
        'create extension if not exists vector;\n' +
        '\n' +
        '-- One row per Drive file (documents and the product catalog sheet).\n' +
        'create table if not exists kb_documents (\n' +
        '  id text primary key,                         -- Drive file ID\n' +
        '  doc_code text not null,                      -- document number; same number = versions of one document\n' +
        '  title text not null,\n' +
        '  product text not null default \'general\',     -- quenvara | lumetra | aurivex | general\n' +
        '  doc_type text,\n' +
        '  version text,\n' +
        '  effective_date date,\n' +
        '  status text not null default \'current\' check (status in (\'current\', \'superseded\')),\n' +
        '  access_level text not null check (access_level in (\'public\', \'internal\', \'medical\')),\n' +
        '  folder text,\n' +
        '  mime_type text,\n' +
        '  url text,\n' +
        '  modified_time timestamptz,\n' +
        '  parse_method text,\n' +
        '  parse_flags text[] not null default \'{}\',\n' +
        '  parser_version int not null default 1,\n' +
        '  summary text,\n' +
        '  chunk_count int not null default 0,\n' +
        '  indexed_at timestamptz not null default now()\n' +
        ');\n' +
        'create index if not exists kb_documents_code_idx on kb_documents (doc_code);\n' +
        '\n' +
        'create table if not exists kb_chunks (\n' +
        '  id bigserial primary key,\n' +
        '  document_id text not null references kb_documents (id) on delete cascade,\n' +
        '  chunk_index int not null,\n' +
        '  section text,\n' +
        '  page int,\n' +
        '  content text not null,\n' +
        '  context text,\n' +
        '  embedding vector(1536) not null,\n' +
        '  fts tsvector not null\n' +
        ');\n' +
        'create index if not exists kb_chunks_document_idx on kb_chunks (document_id);\n' +
        'create index if not exists kb_chunks_fts_idx on kb_chunks using gin (fts);\n' +
        'create index if not exists kb_chunks_embedding_idx on kb_chunks using hnsw (embedding vector_cosine_ops);\n' +
        '\n' +
        'create table if not exists kb_products (\n' +
        '  id serial primary key,\n' +
        '  source_file_id text not null references kb_documents (id) on delete cascade,\n' +
        '  product text not null,\n' +
        '  generic_name text,\n' +
        '  strength text,\n' +
        '  dosage_form text,\n' +
        '  package text,\n' +
        '  ndc text,\n' +
        '  storage text,\n' +
        '  list_price numeric,\n' +
        '  supply_status text,\n' +
        '  notes text,\n' +
        '  updated_at timestamptz not null default now()\n' +
        ');\n' +
        '\n' +
        '-- Audit trail: one row per question.\n' +
        'create table if not exists kb_turns (\n' +
        '  id text primary key,\n' +
        '  created_at timestamptz not null default now(),\n' +
        '  session_id text not null,\n' +
        '  channel text not null,\n' +
        '  role text not null,\n' +
        '  question text,\n' +
        '  standalone_question text,\n' +
        '  answer text,\n' +
        '  route text,\n' +
        '  flags jsonb not null default \'{}\',\n' +
        '  sources jsonb not null default \'[]\',\n' +
        '  case_refs text[] not null default \'{}\',\n' +
        '  tools text[] not null default \'{}\',\n' +
        '  latency_ms int,\n' +
        '  error text,\n' +
        '  feedback smallint,\n' +
        '  feedback_comment text,\n' +
        '  feedback_at timestamptz\n' +
        ');\n' +
        'create index if not exists kb_turns_created_idx on kb_turns (created_at);\n' +
        'create index if not exists kb_turns_session_idx on kb_turns (session_id);\n' +
        '\n' +
        '-- Adverse events, product complaints and Medical Information requests.\n' +
        'create table if not exists kb_cases (\n' +
        '  ref text primary key,\n' +
        '  case_type text not null check (case_type in (\'adverse_event\', \'product_complaint\', \'mi_request\')),\n' +
        '  created_at timestamptz not null default now(),\n' +
        '  updated_at timestamptz not null default now(),\n' +
        '  due_at timestamptz,\n' +
        '  status text not null default \'new\',\n' +
        '  session_id text not null,\n' +
        '  channel text,\n' +
        '  reporter_role text,\n' +
        '  product text,\n' +
        '  summary text,\n' +
        '  details jsonb not null default \'{}\',\n' +
        '  followups jsonb not null default \'[]\',\n' +
        '  source_turn_id text\n' +
        ');\n' +
        'create index if not exists kb_cases_session_idx on kb_cases (session_id, case_type);\n' +
        '\n' +
        '-- Postgres Chat Memory (same shape n8n creates on its own).\n' +
        'create table if not exists kb_chat_histories (\n' +
        '  id serial primary key,\n' +
        '  session_id varchar(255) not null,\n' +
        '  message jsonb not null\n' +
        ');\n' +
        'create index if not exists kb_chat_histories_session_idx on kb_chat_histories (session_id);\n' +
        '\n' +
        '-- Latest effective date wins; everything else with the same document number is superseded.\n' +
        'create or replace function kb_refresh_status(p_code text) returns void\n' +
        'language sql as $$\n' +
        '  update kb_documents d\n' +
        '  set status = case when d.id = (\n' +
        '      select id from kb_documents\n' +
        '      where doc_code = p_code\n' +
        '      order by effective_date desc nulls last, modified_time desc nulls last\n' +
        '      limit 1) then \'current\' else \'superseded\' end\n' +
        '  where d.doc_code = p_code;\n' +
        '$$;\n' +
        '\n' +
        '-- Replace one document\'s chunks and recompute version status, in one transaction.\n' +
        'create or replace function kb_index_document(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  d jsonb := p -> \'document\';\n' +
        '  v_id text := d ->> \'id\';\n' +
        '  v_old_code text;\n' +
        '  v_count int;\n' +
        'begin\n' +
        '  if jsonb_array_length(coalesce(p -> \'chunks\', \'[]\')) = 0 then\n' +
        '    raise exception \'kb_index_document: no chunks for %, refusing to empty the index\', v_id;\n' +
        '  end if;\n' +
        '  select doc_code into v_old_code from kb_documents where id = v_id;\n' +
        '\n' +
        '  insert into kb_documents as k (id, doc_code, title, product, doc_type, version, effective_date, access_level,\n' +
        '    folder, mime_type, url, modified_time, parse_method, parse_flags, parser_version, summary, indexed_at)\n' +
        '  values (v_id, d ->> \'doc_code\', d ->> \'title\', coalesce(nullif(lower(d ->> \'product\'), \'\'), \'general\'),\n' +
        '    d ->> \'doc_type\', d ->> \'version\', nullif(d ->> \'effective_date\', \'\')::date, d ->> \'access_level\',\n' +
        '    d ->> \'folder\', d ->> \'mime_type\', d ->> \'url\', nullif(d ->> \'modified_time\', \'\')::timestamptz,\n' +
        '    d ->> \'parse_method\', array(select jsonb_array_elements_text(coalesce(d -> \'parse_flags\', \'[]\'))),\n' +
        '    coalesce((d ->> \'parser_version\')::int, 1), d ->> \'summary\', now())\n' +
        '  on conflict (id) do update set\n' +
        '    doc_code = excluded.doc_code, title = excluded.title, product = excluded.product,\n' +
        '    doc_type = excluded.doc_type, version = excluded.version, effective_date = excluded.effective_date,\n' +
        '    access_level = excluded.access_level, folder = excluded.folder, mime_type = excluded.mime_type,\n' +
        '    url = excluded.url, modified_time = excluded.modified_time, parse_method = excluded.parse_method,\n' +
        '    parse_flags = excluded.parse_flags, parser_version = excluded.parser_version,\n' +
        '    summary = excluded.summary, indexed_at = now();\n' +
        '\n' +
        '  delete from kb_chunks where document_id = v_id;\n' +
        '\n' +
        '  insert into kb_chunks (document_id, chunk_index, section, page, content, context, embedding, fts)\n' +
        '  select v_id, (c ->> \'chunk_index\')::int, c ->> \'section\', nullif(c ->> \'page\', \'\')::int,\n' +
        '    c ->> \'content\', c ->> \'context\', (c ->> \'embedding\')::vector,\n' +
        '    setweight(to_tsvector(\'english\', coalesce(d ->> \'title\', \'\') || \' \' || coalesce(d ->> \'doc_code\', \'\')), \'A\') ||\n' +
        '    setweight(to_tsvector(\'english\', coalesce(c ->> \'section\', \'\')), \'B\') ||\n' +
        '    setweight(to_tsvector(\'english\', coalesce(c ->> \'context\', \'\') || \' \' || coalesce(c ->> \'content\', \'\')), \'C\')\n' +
        '  from jsonb_array_elements(p -> \'chunks\') c;\n' +
        '  get diagnostics v_count = row_count;\n' +
        '\n' +
        '  update kb_documents set chunk_count = v_count where id = v_id;\n' +
        '  perform kb_refresh_status(d ->> \'doc_code\');\n' +
        '  if v_old_code is not null and v_old_code <> d ->> \'doc_code\' then\n' +
        '    perform kb_refresh_status(v_old_code);\n' +
        '  end if;\n' +
        '\n' +
        '  return jsonb_build_object(\'document_id\', v_id, \'doc_code\', d ->> \'doc_code\', \'chunks\', v_count,\n' +
        '    \'status\', (select status from kb_documents where id = v_id));\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        'create or replace function kb_delete_document(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  v_code text;\n' +
        'begin\n' +
        '  delete from kb_documents where id = p ->> \'id\' returning doc_code into v_code;\n' +
        '  if v_code is not null then\n' +
        '    perform kb_refresh_status(v_code);\n' +
        '  end if;\n' +
        '  return jsonb_build_object(\'id\', p ->> \'id\', \'doc_code\', v_code, \'deleted\', v_code is not null);\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        'create or replace function kb_registry(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  select coalesce(jsonb_agg(jsonb_build_object(\n' +
        '    \'id\', id, \'doc_code\', doc_code, \'title\', title, \'version\', version, \'status\', status,\n' +
        '    \'modified_time\', modified_time, \'parser_version\', parser_version, \'chunk_count\', chunk_count)\n' +
        '    order by doc_code, effective_date), \'[]\'::jsonb)\n' +
        '  from kb_documents;\n' +
        '$$;\n' +
        '\n' +
        '-- Hybrid search: vector and keyword rankings merged with reciprocal rank fusion.\n' +
        '-- p: { query, embedding: [1536 floats], access: [...], product, include_superseded, k }\n' +
        'create or replace function kb_search(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  with params as (\n' +
        '    select (p ->> \'embedding\')::vector(1536) as qe,\n' +
        '      array(select jsonb_array_elements_text(p -> \'access\')) as acc,\n' +
        '      nullif(nullif(lower(coalesce(p ->> \'product\', \'\')), \'\'), \'any\') as prod,\n' +
        '      coalesce((p ->> \'include_superseded\')::boolean, false) as sup,\n' +
        '      least(coalesce((p ->> \'k\')::int, 20), 40) as k,\n' +
        '      -- keep letters, digits and code punctuation, drop leading minus signs, OR the words together\n' +
        '      regexp_replace(trim(regexp_replace(regexp_replace(coalesce(p ->> \'query\', \'\'),\n' +
        '        \'[^[:alnum:][:space:]._/-]\', \' \', \'g\'), \'(^|\\s)-+\', \'\\1\', \'g\')), \'\\s+\', \' or \', \'g\') as words\n' +
        '  ),\n' +
        '  tsq as (\n' +
        '    select case when words = \'\' then null else websearch_to_tsquery(\'english\', words) end as tq from params\n' +
        '  ),\n' +
        '  filtered as (\n' +
        '    select c.id, c.embedding, c.fts\n' +
        '    from kb_chunks c\n' +
        '    join kb_documents d on d.id = c.document_id\n' +
        '    cross join params\n' +
        '    where d.access_level = any (params.acc)\n' +
        '      and (params.prod is null or d.product in (params.prod, \'general\'))\n' +
        '      and (params.sup or d.status = \'current\')\n' +
        '  ),\n' +
        '  vec as (\n' +
        '    select f.id, row_number() over (order by f.embedding <=> params.qe) as r\n' +
        '    from filtered f cross join params\n' +
        '    order by f.embedding <=> params.qe\n' +
        '    limit 40\n' +
        '  ),\n' +
        '  kw as (\n' +
        '    select f.id, row_number() over (order by ts_rank(f.fts, tsq.tq) desc) as r\n' +
        '    from filtered f cross join tsq\n' +
        '    where tsq.tq is not null and f.fts @@ tsq.tq\n' +
        '    order by ts_rank(f.fts, tsq.tq) desc\n' +
        '    limit 40\n' +
        '  ),\n' +
        '  fused as (\n' +
        '    select coalesce(vec.id, kw.id) as id, vec.r as vr, kw.r as kr,\n' +
        '      coalesce(1.0 / (50 + vec.r), 0) + coalesce(1.0 / (50 + kw.r), 0) as score\n' +
        '    from vec full outer join kw on vec.id = kw.id\n' +
        '  ),\n' +
        '  best as (\n' +
        '    select f.* from fused f order by f.score desc limit (select k from params)\n' +
        '  )\n' +
        '  select coalesce(jsonb_agg(jsonb_build_object(\n' +
        '      \'id\', \'c\' || c.id, \'doc_code\', d.doc_code, \'title\', d.title, \'product\', d.product,\n' +
        '      \'doc_type\', d.doc_type, \'version\', d.version, \'effective_date\', d.effective_date,\n' +
        '      \'status\', d.status, \'access_level\', d.access_level, \'section\', c.section, \'page\', c.page,\n' +
        '      \'url\', d.url, \'parse_flags\', d.parse_flags, \'context\', c.context, \'text\', c.content,\n' +
        '      \'vector_rank\', t.vr, \'keyword_rank\', t.kr, \'score\', round(t.score::numeric, 5))\n' +
        '    order by t.score desc), \'[]\'::jsonb)\n' +
        '  from best t\n' +
        '  join kb_chunks c on c.id = t.id\n' +
        '  join kb_documents d on d.id = c.document_id;\n' +
        '$$;\n' +
        '\n' +
        '-- The whole section around a chunk, if the caller may see it. p: { chunk_id: \'c123\', access: [...] }\n' +
        'create or replace function kb_read_section(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  with target as (\n' +
        '    select c.document_id, c.section\n' +
        '    from kb_chunks c\n' +
        '    join kb_documents d on d.id = c.document_id\n' +
        '    where c.id = nullif(regexp_replace(coalesce(p ->> \'chunk_id\', \'\'), \'\\D\', \'\', \'g\'), \'\')::bigint\n' +
        '      and d.access_level = any (array(select jsonb_array_elements_text(p -> \'access\')))\n' +
        '  )\n' +
        '  select coalesce((\n' +
        '    select jsonb_build_object(\'found\', true, \'id\', \'c\' || min(c.id), \'requested\', p ->> \'chunk_id\',\n' +
        '      \'doc_code\', d.doc_code, \'title\', d.title, \'version\', d.version, \'effective_date\', d.effective_date,\n' +
        '      \'status\', d.status, \'section\', t.section, \'url\', d.url,\n' +
        '      \'pages\', (select jsonb_agg(distinct c2.page) from kb_chunks c2\n' +
        '                where c2.document_id = t.document_id and c2.section is not distinct from t.section),\n' +
        '      \'text\', left(string_agg(c.content, E\'\\n\\n\' order by c.chunk_index), 9000))\n' +
        '    from target t\n' +
        '    join kb_chunks c on c.document_id = t.document_id and c.section is not distinct from t.section\n' +
        '    join kb_documents d on d.id = t.document_id\n' +
        '    group by d.doc_code, d.title, d.version, d.effective_date, d.status, t.section, d.url, t.document_id),\n' +
        '    jsonb_build_object(\'found\', false, \'requested\', p ->> \'chunk_id\',\n' +
        '      \'message\', \'No section with that citation ID that this user may read.\'));\n' +
        '$$;\n' +
        '\n' +
        '-- Catalog rows matching a product name, strength or NDC. p: { term }\n' +
        'create or replace function kb_lookup_product(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  with q as (\n' +
        '    select nullif(trim(coalesce(p ->> \'term\', \'\')), \'\') as term,\n' +
        '      nullif(regexp_replace(coalesce(p ->> \'term\', \'\'), \'\\D\', \'\', \'g\'), \'\') as digits\n' +
        '  )\n' +
        '  select coalesce(jsonb_agg(jsonb_build_object(\n' +
        '      \'id\', \'p\' || x.id, \'product\', x.product, \'generic_name\', x.generic_name, \'strength\', x.strength,\n' +
        '      \'dosage_form\', x.dosage_form, \'package\', x.package, \'ndc\', x.ndc, \'storage\', x.storage,\n' +
        '      \'list_price_usd\', x.list_price, \'supply_status\', x.supply_status, \'notes\', x.notes,\n' +
        '      \'doc_code\', d.doc_code, \'title\', d.title, \'version\', d.version, \'effective_date\', d.effective_date,\n' +
        '      \'url\', d.url) order by x.product, x.id), \'[]\'::jsonb)\n' +
        '  from kb_products x\n' +
        '  join kb_documents d on d.id = x.source_file_id\n' +
        '  cross join q\n' +
        '  where q.term is null\n' +
        '    or x.product ilike \'%\' || q.term || \'%\'\n' +
        '    or q.term ilike \'%\' || x.product || \'%\'\n' +
        '    or x.generic_name ilike \'%\' || q.term || \'%\'\n' +
        '    or (x.product || \' \' || x.strength) ilike \'%\' || q.term || \'%\'\n' +
        '    or (length(q.digits) >= 4 and regexp_replace(x.ndc, \'\\D\', \'\', \'g\') like \'%\' || q.digits || \'%\');\n' +
        '$$;\n' +
        '\n' +
        '-- Replace the catalog from the sheet. p: { document: {...}, rows: [...] }\n' +
        'create or replace function kb_replace_products(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  d jsonb := p -> \'document\';\n' +
        '  v_count int;\n' +
        'begin\n' +
        '  if jsonb_array_length(coalesce(p -> \'rows\', \'[]\')) = 0 then\n' +
        '    raise exception \'kb_replace_products: the catalog has no rows, refusing to empty it\';\n' +
        '  end if;\n' +
        '  insert into kb_documents (id, doc_code, title, product, doc_type, version, effective_date, access_level,\n' +
        '    folder, mime_type, url, modified_time, parse_method, summary, indexed_at)\n' +
        '  values (d ->> \'id\', d ->> \'doc_code\', d ->> \'title\', \'general\', \'Product catalog\', d ->> \'version\',\n' +
        '    nullif(d ->> \'effective_date\', \'\')::date, d ->> \'access_level\', d ->> \'folder\', d ->> \'mime_type\',\n' +
        '    d ->> \'url\', nullif(d ->> \'modified_time\', \'\')::timestamptz, \'sheet_catalog\', d ->> \'summary\', now())\n' +
        '  on conflict (id) do update set doc_code = excluded.doc_code, title = excluded.title,\n' +
        '    version = excluded.version, effective_date = excluded.effective_date,\n' +
        '    access_level = excluded.access_level, folder = excluded.folder, url = excluded.url,\n' +
        '    modified_time = excluded.modified_time, indexed_at = now();\n' +
        '\n' +
        '  delete from kb_products where source_file_id = d ->> \'id\';\n' +
        '  insert into kb_products (source_file_id, product, generic_name, strength, dosage_form, package, ndc,\n' +
        '    storage, list_price, supply_status, notes)\n' +
        '  select d ->> \'id\', r ->> \'product\', r ->> \'generic_name\', r ->> \'strength\', r ->> \'dosage_form\',\n' +
        '    r ->> \'package\', r ->> \'ndc\', r ->> \'storage\',\n' +
        '    nullif(regexp_replace(coalesce(r ->> \'list_price\', \'\'), \'[^0-9.]\', \'\', \'g\'), \'\')::numeric,\n' +
        '    r ->> \'supply_status\', r ->> \'notes\'\n' +
        '  from jsonb_array_elements(p -> \'rows\') r\n' +
        '  where coalesce(r ->> \'product\', \'\') <> \'\';\n' +
        '  get diagnostics v_count = row_count;\n' +
        '  update kb_documents set chunk_count = 0 where id = d ->> \'id\';\n' +
        '  perform kb_refresh_status(d ->> \'doc_code\');\n' +
        '  return jsonb_build_object(\'document_id\', d ->> \'id\', \'rows\', v_count);\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        '-- What the Answer workflow needs before the screen. p: { session_id }\n' +
        'create or replace function kb_context(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  select jsonb_build_object(\n' +
        '    \'history\', coalesce((\n' +
        '      select jsonb_agg(jsonb_build_object(\'role\', coalesce(m.message ->> \'type\', \'unknown\'),\n' +
        '        \'text\', left(coalesce(m.message ->> \'content\', m.message -> \'data\' ->> \'content\', \'\'), 700)) order by m.id)\n' +
        '      from (select id, message from kb_chat_histories where session_id = p ->> \'session_id\'\n' +
        '            order by id desc limit 6) m), \'[]\'::jsonb),\n' +
        '    \'open_cases\', coalesce((\n' +
        '      select jsonb_agg(jsonb_build_object(\'ref\', ref, \'case_type\', case_type, \'product\', product) order by created_at)\n' +
        '      from kb_cases\n' +
        '      where session_id = p ->> \'session_id\' and case_type in (\'adverse_event\', \'product_complaint\')\n' +
        '        and created_at > now() - interval \'1 day\'), \'[]\'::jsonb),\n' +
        '    \'mi_requests\', (select count(*) from kb_cases where session_id = p ->> \'session_id\' and case_type = \'mi_request\'));\n' +
        '$$;\n' +
        '\n' +
        '-- Create a case, or add follow-up information to it if the ref already exists.\n' +
        '-- p: { ref, case_type, session_id, channel, reporter_role, product, summary, details, turn_id }\n' +
        'create or replace function kb_upsert_case(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  v_new boolean;\n' +
        'begin\n' +
        '  insert into kb_cases as k (ref, case_type, due_at, session_id, channel, reporter_role, product, summary, details, source_turn_id)\n' +
        '  values (p ->> \'ref\', p ->> \'case_type\',\n' +
        '    now() + case when p ->> \'case_type\' = \'mi_request\' then interval \'2 days\' else interval \'1 day\' end,\n' +
        '    p ->> \'session_id\', p ->> \'channel\', p ->> \'reporter_role\', nullif(lower(p ->> \'product\'), \'\'),\n' +
        '    p ->> \'summary\', coalesce(p -> \'details\', \'{}\'), p ->> \'turn_id\')\n' +
        '  on conflict (ref) do update set\n' +
        '    followups = k.followups || jsonb_build_array(jsonb_build_object(\'at\', now(), \'summary\', p ->> \'summary\',\n' +
        '      \'details\', coalesce(p -> \'details\', \'{}\'), \'turn_id\', p ->> \'turn_id\')),\n' +
        '    updated_at = now()\n' +
        '  returning (xmax = 0) into v_new;\n' +
        '  return jsonb_build_object(\'ref\', p ->> \'ref\', \'case_type\', p ->> \'case_type\', \'new\', v_new);\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        '-- Medical Information request from the agent tool, with a per-chat limit.\n' +
        '-- p: { ref, session_id, channel, reporter_role, product, requester_name, contact, question, max }\n' +
        'create or replace function kb_request_mi(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  v_count int;\n' +
        'begin\n' +
        '  select count(*) into v_count from kb_cases where session_id = p ->> \'session_id\' and case_type = \'mi_request\';\n' +
        '  if v_count >= coalesce((p ->> \'max\')::int, 3) then\n' +
        '    return jsonb_build_object(\'success\', false, \'message\', \'This chat has reached the limit for Medical Information requests. Ask the person to call the Medical Information line instead.\');\n' +
        '  end if;\n' +
        '  insert into kb_cases (ref, case_type, due_at, session_id, channel, reporter_role, product, summary, details)\n' +
        '  values (p ->> \'ref\', \'mi_request\', now() + interval \'2 days\', p ->> \'session_id\', p ->> \'channel\',\n' +
        '    p ->> \'reporter_role\', nullif(lower(p ->> \'product\'), \'\'), left(p ->> \'question\', 500),\n' +
        '    jsonb_build_object(\'requester_name\', p ->> \'requester_name\', \'contact\', p ->> \'contact\', \'question\', p ->> \'question\'));\n' +
        '  return jsonb_build_object(\'success\', true, \'ref\', p ->> \'ref\',\n' +
        '    \'message\', \'Medical Information request logged. The Medical Information team replies directly within 2 business days.\');\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        '-- One audit row per question, plus any safety cases detected this turn.\n' +
        '-- p: { turn: {...}, cases: [ {ref, case_type, ...} ] }\n' +
        'create or replace function kb_record_turn(p jsonb) returns jsonb\n' +
        'language plpgsql as $$\n' +
        'declare\n' +
        '  t jsonb := p -> \'turn\';\n' +
        '  c jsonb;\n' +
        '  v_cases jsonb := \'[]\';\n' +
        'begin\n' +
        '  insert into kb_turns (id, session_id, channel, role, question, standalone_question, answer, route, flags,\n' +
        '    sources, case_refs, tools, latency_ms, error)\n' +
        '  values (t ->> \'id\', t ->> \'session_id\', t ->> \'channel\', t ->> \'role\', t ->> \'question\',\n' +
        '    t ->> \'standalone_question\', t ->> \'answer\', t ->> \'route\', coalesce(t -> \'flags\', \'{}\'),\n' +
        '    coalesce(t -> \'sources\', \'[]\'), array(select jsonb_array_elements_text(coalesce(t -> \'case_refs\', \'[]\'))),\n' +
        '    array(select jsonb_array_elements_text(coalesce(t -> \'tools\', \'[]\'))),\n' +
        '    nullif(t ->> \'latency_ms\', \'\')::int, nullif(t ->> \'error\', \'\'))\n' +
        '  on conflict (id) do nothing;\n' +
        '\n' +
        '  for c in select * from jsonb_array_elements(coalesce(p -> \'cases\', \'[]\')) loop\n' +
        '    v_cases := v_cases || jsonb_build_array(kb_upsert_case(c || jsonb_build_object(\'turn_id\', t ->> \'id\')));\n' +
        '  end loop;\n' +
        '  return jsonb_build_object(\'turn_id\', t ->> \'id\', \'cases\', v_cases);\n' +
        'end;\n' +
        '$$;\n' +
        '\n' +
        '-- p: { turn_id, rating: 1 | -1, comment }\n' +
        'create or replace function kb_feedback(p jsonb) returns jsonb\n' +
        'language sql as $$\n' +
        '  update kb_turns set feedback = case when (p ->> \'rating\')::int > 0 then 1 else -1 end,\n' +
        '    feedback_comment = left(p ->> \'comment\', 1000), feedback_at = now()\n' +
        '  where id = p ->> \'turn_id\'\n' +
        '  returning jsonb_build_object(\'ok\', true, \'turn_id\', id);\n' +
        '$$;\n' +
        '\n' +
        '-- Weekly numbers for the insights report. p: { days }\n' +
        'create or replace function kb_weekly_stats(p jsonb) returns jsonb\n' +
        'language sql stable as $$\n' +
        '  with t as (\n' +
        '    select * from kb_turns\n' +
        '    where created_at > now() - make_interval(days => coalesce((p ->> \'days\')::int, 7)) and channel <> \'eval\'\n' +
        '  )\n' +
        '  select jsonb_build_object(\n' +
        '    \'questions\', (select count(*) from t),\n' +
        '    \'sessions\', (select count(distinct session_id) from t),\n' +
        '    \'by_role\', coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from t group by role) x), \'{}\'::jsonb),\n' +
        '    \'by_route\', coalesce((select jsonb_object_agg(route, n) from (select coalesce(route, \'unknown\') route, count(*) n from t group by 1) x), \'{}\'::jsonb),\n' +
        '    \'thumbs_up\', (select count(*) from t where feedback = 1),\n' +
        '    \'thumbs_down\', (select count(*) from t where feedback = -1),\n' +
        '    \'median_latency_ms\', (select percentile_cont(0.5) within group (order by latency_ms) from t where latency_ms is not null),\n' +
        '    \'p90_latency_ms\', (select percentile_cont(0.9) within group (order by latency_ms) from t where latency_ms is not null),\n' +
        '    \'top_documents\', coalesce((select jsonb_agg(x order by x.n desc) from (\n' +
        '        select s ->> \'doc_code\' as doc_code, max(s ->> \'title\') as title, count(*) n\n' +
        '        from t, jsonb_array_elements(t.sources) s group by 1 order by 3 desc limit 5) x), \'[]\'::jsonb),\n' +
        '    \'cases_opened\', coalesce((select jsonb_object_agg(case_type, n) from (\n' +
        '        select case_type, count(*) n from kb_cases\n' +
        '        where created_at > now() - make_interval(days => coalesce((p ->> \'days\')::int, 7))\n' +
        '          and session_id not like \'eval-%\' group by 1) x), \'{}\'::jsonb),\n' +
        '    \'cases_overdue\', coalesce((select jsonb_agg(jsonb_build_object(\'ref\', ref, \'case_type\', case_type, \'due_at\', due_at))\n' +
        '        from kb_cases where status = \'new\' and due_at < now() and session_id not like \'eval-%\'), \'[]\'::jsonb),\n' +
        '    \'gap_questions\', coalesce((select jsonb_agg(jsonb_build_object(\'question\', coalesce(standalone_question, question),\n' +
        '        \'route\', route, \'feedback\', feedback, \'comment\', feedback_comment))\n' +
        '        from (select * from t where route = \'not_in_documents\' or feedback = -1 order by created_at desc limit 60) g), \'[]\'::jsonb));\n' +
        '$$;\n' +
        '\n' +
        '-- Lock down: no access for the public Supabase keys (n8n connects as the database owner).\n' +
        'alter table kb_documents enable row level security;\n' +
        'alter table kb_chunks enable row level security;\n' +
        'alter table kb_products enable row level security;\n' +
        'alter table kb_turns enable row level security;\n' +
        'alter table kb_cases enable row level security;\n' +
        'alter table kb_chat_histories enable row level security;\n' +
        'revoke all on kb_documents, kb_chunks, kb_products, kb_turns, kb_cases, kb_chat_histories from anon, authenticated;\n' +
        '\n' +
        'revoke all on function kb_refresh_status(text) from public, anon, authenticated;\n' +
        'revoke all on function kb_index_document(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_delete_document(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_registry(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_search(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_read_section(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_lookup_product(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_replace_products(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_context(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_upsert_case(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_request_mi(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_record_turn(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_feedback(jsonb) from public, anon, authenticated;\n' +
        'revoke all on function kb_weekly_stats(jsonb) from public, anon, authenticated;\n' +
        '\n' +
        'select jsonb_build_object(\n' +
        '  \'tables\', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname = \'public\' and tablename like \'kb\\_%\'),\n' +
        '  \'functions\', (select jsonb_agg(proname order by proname) from pg_proc where proname like \'kb\\_%\'),\n' +
        '  \'rls_off\', (select coalesce(jsonb_agg(relname), \'[]\'::jsonb) from pg_class\n' +
        '              where relname like \'kb\\_%\' and relkind = \'r\' and not relrowsecurity),\n' +
        '  \'anon_can_search\', has_function_privilege(\'anon\', \'kb_search(jsonb)\', \'execute\'),\n' +
        '  \'pgvector\', (select extversion from pg_extension where extname = \'vector\')) as setup_check;\n'
      ,
      options: { queryBatching: 'single' }
    },
    credentials: PG_CRED
  },
  output: [{ setup_check: { tables: ['kb_cases'], functions: ['kb_search'], rls_off: [], anon_can_search: false, pgvector: '0.8.2' } }]
});

const note = sticky(
  '## MedInfo database setup\n' +
  'Runs `supabase/setup.sql` in the Supabase project: the `kb_*` tables, hybrid search and the other SQL functions. Safe to run again after editing the SQL.\n\n' +
  'The last row checks the result: every table has row level security on, and the public `anon` key cannot call `kb_search`.',
  [start, runSql],
  { color: 4 }
);

export default workflow('medinfo-database-setup', 'MedInfo 0a: Database Setup')
  .add(start)
  .to(runSql)
  .add(note);
