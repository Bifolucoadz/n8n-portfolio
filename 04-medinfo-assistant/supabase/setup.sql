-- MedInfo Assistant (portfolio project 4). Run by "MedInfo 0a: Database Setup" through the
-- Postgres credential; safe to run again. Every function takes one jsonb argument and returns
-- jsonb, so n8n passes a single JSON query parameter.
-- Keep dollar-digit placeholders out of this file: n8n's Postgres node would try to fill them.

create extension if not exists vector;

-- One row per Drive file (documents and the product catalog sheet).
create table if not exists kb_documents (
  id text primary key,                         -- Drive file ID
  doc_code text not null,                      -- document number; same number = versions of one document
  title text not null,
  product text not null default 'general',     -- quenvara | lumetra | aurivex | general
  doc_type text,
  version text,
  effective_date date,
  status text not null default 'current' check (status in ('current', 'superseded')),
  access_level text not null check (access_level in ('public', 'internal', 'medical')),
  folder text,
  mime_type text,
  url text,
  modified_time timestamptz,
  parse_method text,
  parse_flags text[] not null default '{}',
  parser_version int not null default 1,
  summary text,
  chunk_count int not null default 0,
  indexed_at timestamptz not null default now()
);
create index if not exists kb_documents_code_idx on kb_documents (doc_code);

create table if not exists kb_chunks (
  id bigserial primary key,
  document_id text not null references kb_documents (id) on delete cascade,
  chunk_index int not null,
  section text,
  page int,
  content text not null,
  context text,
  embedding vector(1536) not null,
  fts tsvector not null
);
create index if not exists kb_chunks_document_idx on kb_chunks (document_id);
create index if not exists kb_chunks_fts_idx on kb_chunks using gin (fts);
create index if not exists kb_chunks_embedding_idx on kb_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists kb_products (
  id serial primary key,
  source_file_id text not null references kb_documents (id) on delete cascade,
  product text not null,
  generic_name text,
  strength text,
  dosage_form text,
  package text,
  ndc text,
  storage text,
  list_price numeric,
  supply_status text,
  notes text,
  updated_at timestamptz not null default now()
);

-- Audit trail: one row per question.
create table if not exists kb_turns (
  id text primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  channel text not null,
  role text not null,
  question text,
  standalone_question text,
  answer text,
  route text,
  flags jsonb not null default '{}',
  sources jsonb not null default '[]',
  case_refs text[] not null default '{}',
  tools text[] not null default '{}',
  latency_ms int,
  error text,
  feedback smallint,
  feedback_comment text,
  feedback_at timestamptz
);
create index if not exists kb_turns_created_idx on kb_turns (created_at);
create index if not exists kb_turns_session_idx on kb_turns (session_id);

-- Adverse events, product complaints and Medical Information requests.
create table if not exists kb_cases (
  ref text primary key,
  case_type text not null check (case_type in ('adverse_event', 'product_complaint', 'mi_request')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'new',
  session_id text not null,
  channel text,
  reporter_role text,
  product text,
  summary text,
  details jsonb not null default '{}',
  followups jsonb not null default '[]',
  source_turn_id text
);
create index if not exists kb_cases_session_idx on kb_cases (session_id, case_type);

-- Conversation history, written by kb_record_turn (same shape as n8n's Postgres Chat Memory).
create table if not exists kb_chat_histories (
  id serial primary key,
  session_id varchar(255) not null,
  message jsonb not null
);
create index if not exists kb_chat_histories_session_idx on kb_chat_histories (session_id);

-- Latest effective date wins; everything else with the same document number is superseded.
create or replace function kb_refresh_status(p_code text) returns void
language sql as $$
  update kb_documents d
  set status = case when d.id = (
      select id from kb_documents
      where doc_code = p_code
      order by effective_date desc nulls last, modified_time desc nulls last
      limit 1) then 'current' else 'superseded' end
  where d.doc_code = p_code;
$$;

-- Replace one document's chunks and recompute version status, in one transaction.
create or replace function kb_index_document(p jsonb) returns jsonb
language plpgsql as $$
declare
  d jsonb := p -> 'document';
  v_id text := d ->> 'id';
  v_old_code text;
  v_count int;
begin
  if jsonb_array_length(coalesce(p -> 'chunks', '[]')) = 0 then
    raise exception 'kb_index_document: no chunks for %, refusing to empty the index', v_id;
  end if;
  select doc_code into v_old_code from kb_documents where id = v_id;

  insert into kb_documents as k (id, doc_code, title, product, doc_type, version, effective_date, access_level,
    folder, mime_type, url, modified_time, parse_method, parse_flags, parser_version, summary, indexed_at)
  values (v_id, d ->> 'doc_code', d ->> 'title', coalesce(nullif(lower(d ->> 'product'), ''), 'general'),
    d ->> 'doc_type', d ->> 'version', nullif(d ->> 'effective_date', '')::date, d ->> 'access_level',
    d ->> 'folder', d ->> 'mime_type', d ->> 'url', nullif(d ->> 'modified_time', '')::timestamptz,
    d ->> 'parse_method', array(select jsonb_array_elements_text(coalesce(d -> 'parse_flags', '[]'))),
    coalesce((d ->> 'parser_version')::int, 1), d ->> 'summary', now())
  on conflict (id) do update set
    doc_code = excluded.doc_code, title = excluded.title, product = excluded.product,
    doc_type = excluded.doc_type, version = excluded.version, effective_date = excluded.effective_date,
    access_level = excluded.access_level, folder = excluded.folder, mime_type = excluded.mime_type,
    url = excluded.url, modified_time = excluded.modified_time, parse_method = excluded.parse_method,
    parse_flags = excluded.parse_flags, parser_version = excluded.parser_version,
    summary = excluded.summary, indexed_at = now();

  delete from kb_chunks where document_id = v_id;

  insert into kb_chunks (document_id, chunk_index, section, page, content, context, embedding, fts)
  select v_id, (c ->> 'chunk_index')::int, c ->> 'section', nullif(c ->> 'page', '')::int,
    c ->> 'content', c ->> 'context', (c ->> 'embedding')::vector,
    setweight(to_tsvector('english', coalesce(d ->> 'title', '') || ' ' || coalesce(d ->> 'doc_code', '')), 'A') ||
    setweight(to_tsvector('english', coalesce(c ->> 'section', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(c ->> 'context', '') || ' ' || coalesce(c ->> 'content', '')), 'C')
  from jsonb_array_elements(p -> 'chunks') c;
  get diagnostics v_count = row_count;

  update kb_documents set chunk_count = v_count where id = v_id;
  perform kb_refresh_status(d ->> 'doc_code');
  if v_old_code is not null and v_old_code <> d ->> 'doc_code' then
    perform kb_refresh_status(v_old_code);
  end if;

  return jsonb_build_object('document_id', v_id, 'doc_code', d ->> 'doc_code', 'chunks', v_count,
    'status', (select status from kb_documents where id = v_id));
end;
$$;

create or replace function kb_delete_document(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_code text;
begin
  delete from kb_documents where id = p ->> 'id' returning doc_code into v_code;
  if v_code is not null then
    perform kb_refresh_status(v_code);
  end if;
  return jsonb_build_object('id', p ->> 'id', 'doc_code', v_code, 'deleted', v_code is not null);
end;
$$;

create or replace function kb_registry(p jsonb) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'doc_code', doc_code, 'title', title, 'version', version, 'status', status,
    'modified_time', modified_time, 'parser_version', parser_version, 'chunk_count', chunk_count,
    'access_level', access_level)
    order by doc_code, effective_date), '[]'::jsonb)
  from kb_documents;
$$;

-- Hybrid search: vector and keyword rankings merged with reciprocal rank fusion.
-- p: { query, embedding: [1536 floats], access: [...], product, include_superseded, k }
create or replace function kb_search(p jsonb) returns jsonb
language sql stable as $$
  with params as (
    select (p ->> 'embedding')::vector(1536) as qe,
      array(select jsonb_array_elements_text(p -> 'access')) as acc,
      nullif(nullif(lower(coalesce(p ->> 'product', '')), ''), 'any') as prod,
      coalesce((p ->> 'include_superseded')::boolean, false) as sup,
      least(coalesce((p ->> 'k')::int, 20), 40) as k,
      -- keep letters, digits and code punctuation, drop leading minus signs, OR the words together
      regexp_replace(trim(regexp_replace(regexp_replace(coalesce(p ->> 'query', ''),
        '[^[:alnum:][:space:]._/-]', ' ', 'g'), '(^|\s)-+', '\1', 'g')), '\s+', ' or ', 'g') as words
  ),
  tsq as (
    select case when words = '' then null else websearch_to_tsquery('english', words) end as tq from params
  ),
  filtered as (
    select c.id, c.embedding, c.fts
    from kb_chunks c
    join kb_documents d on d.id = c.document_id
    cross join params
    where d.access_level = any (params.acc)
      and (params.prod is null or d.product in (params.prod, 'general'))
      and (params.sup or d.status = 'current')
  ),
  vec as (
    select f.id, row_number() over (order by f.embedding <=> params.qe) as r
    from filtered f cross join params
    order by f.embedding <=> params.qe
    limit 40
  ),
  kw as (
    select f.id, row_number() over (order by ts_rank(f.fts, tsq.tq) desc) as r
    from filtered f cross join tsq
    where tsq.tq is not null and f.fts @@ tsq.tq
    order by ts_rank(f.fts, tsq.tq) desc
    limit 40
  ),
  fused as (
    select coalesce(vec.id, kw.id) as id, vec.r as vr, kw.r as kr,
      coalesce(1.0 / (50 + vec.r), 0) + coalesce(1.0 / (50 + kw.r), 0) as score
    from vec full outer join kw on vec.id = kw.id
  ),
  best as (
    select f.* from fused f order by f.score desc limit (select k from params)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', 'c' || c.id, 'doc_code', d.doc_code, 'title', d.title, 'product', d.product,
      'doc_type', d.doc_type, 'version', d.version, 'effective_date', d.effective_date,
      'status', d.status, 'access_level', d.access_level, 'section', c.section, 'page', c.page,
      'url', d.url, 'parse_flags', d.parse_flags, 'context', c.context, 'text', c.content,
      'vector_rank', t.vr, 'keyword_rank', t.kr, 'score', round(t.score::numeric, 5))
    order by t.score desc), '[]'::jsonb)
  from best t
  join kb_chunks c on c.id = t.id
  join kb_documents d on d.id = c.document_id;
$$;

-- The whole section around a chunk, if the caller may see it. p: { chunk_id: 'c123', access: [...] }
create or replace function kb_read_section(p jsonb) returns jsonb
language sql stable as $$
  with target as (
    select c.document_id, c.section
    from kb_chunks c
    join kb_documents d on d.id = c.document_id
    where c.id = nullif(regexp_replace(coalesce(p ->> 'chunk_id', ''), '\D', '', 'g'), '')::bigint
      and d.access_level = any (array(select jsonb_array_elements_text(p -> 'access')))
  )
  select coalesce((
    select jsonb_build_object('found', true, 'id', 'c' || min(c.id), 'requested', p ->> 'chunk_id',
      'doc_code', d.doc_code, 'title', d.title, 'version', d.version, 'effective_date', d.effective_date,
      'status', d.status, 'section', t.section, 'url', d.url,
      'pages', (select jsonb_agg(distinct c2.page) from kb_chunks c2
                where c2.document_id = t.document_id and c2.section is not distinct from t.section),
      'text', left(string_agg(c.content, E'\n\n' order by c.chunk_index), 9000))
    from target t
    join kb_chunks c on c.document_id = t.document_id and c.section is not distinct from t.section
    join kb_documents d on d.id = t.document_id
    group by d.doc_code, d.title, d.version, d.effective_date, d.status, t.section, d.url, t.document_id),
    jsonb_build_object('found', false, 'requested', p ->> 'chunk_id',
      'message', 'No section with that citation ID that this user may read.'));
$$;

-- Catalog rows matching a product name, strength or NDC. p: { term }
create or replace function kb_lookup_product(p jsonb) returns jsonb
language sql stable as $$
  with q as (
    select nullif(trim(coalesce(p ->> 'term', '')), '') as term,
      nullif(regexp_replace(coalesce(p ->> 'term', ''), '\D', '', 'g'), '') as digits
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', 'p' || x.id, 'product', x.product, 'generic_name', x.generic_name, 'strength', x.strength,
      'dosage_form', x.dosage_form, 'package', x.package, 'ndc', x.ndc, 'storage', x.storage,
      'list_price_usd', x.list_price, 'supply_status', x.supply_status, 'notes', x.notes,
      'doc_code', d.doc_code, 'title', d.title, 'version', d.version, 'effective_date', d.effective_date,
      'url', d.url) order by x.product, x.id), '[]'::jsonb)
  from kb_products x
  join kb_documents d on d.id = x.source_file_id
  cross join q
  where q.term is null
    or x.product ilike '%' || q.term || '%'
    or q.term ilike '%' || x.product || '%'
    or x.generic_name ilike '%' || q.term || '%'
    or (x.product || ' ' || x.strength) ilike '%' || q.term || '%'
    or (length(q.digits) >= 4 and regexp_replace(x.ndc, '\D', '', 'g') like '%' || q.digits || '%');
$$;

-- Replace the catalog from the sheet. p: { document: {...}, rows: [...] }
create or replace function kb_replace_products(p jsonb) returns jsonb
language plpgsql as $$
declare
  d jsonb := p -> 'document';
  v_count int;
begin
  if jsonb_array_length(coalesce(p -> 'rows', '[]')) = 0 then
    raise exception 'kb_replace_products: the catalog has no rows, refusing to empty it';
  end if;
  insert into kb_documents (id, doc_code, title, product, doc_type, version, effective_date, access_level,
    folder, mime_type, url, modified_time, parse_method, summary, indexed_at)
  values (d ->> 'id', d ->> 'doc_code', d ->> 'title', 'general', 'Product catalog', d ->> 'version',
    nullif(d ->> 'effective_date', '')::date, d ->> 'access_level', d ->> 'folder', d ->> 'mime_type',
    d ->> 'url', nullif(d ->> 'modified_time', '')::timestamptz, 'sheet_catalog', d ->> 'summary', now())
  on conflict (id) do update set doc_code = excluded.doc_code, title = excluded.title,
    version = excluded.version, effective_date = excluded.effective_date,
    access_level = excluded.access_level, folder = excluded.folder, url = excluded.url,
    modified_time = excluded.modified_time, indexed_at = now();

  delete from kb_products where source_file_id = d ->> 'id';
  insert into kb_products (source_file_id, product, generic_name, strength, dosage_form, package, ndc,
    storage, list_price, supply_status, notes)
  select d ->> 'id', r ->> 'product', r ->> 'generic_name', r ->> 'strength', r ->> 'dosage_form',
    r ->> 'package', r ->> 'ndc', r ->> 'storage',
    nullif(regexp_replace(coalesce(r ->> 'list_price', ''), '[^0-9.]', '', 'g'), '')::numeric,
    r ->> 'supply_status', r ->> 'notes'
  from jsonb_array_elements(p -> 'rows') r
  where coalesce(r ->> 'product', '') <> '';
  get diagnostics v_count = row_count;
  update kb_documents set chunk_count = 0 where id = d ->> 'id';
  perform kb_refresh_status(d ->> 'doc_code');
  return jsonb_build_object('document_id', d ->> 'id', 'rows', v_count);
end;
$$;

-- What the Answer workflow needs before the screen. p: { session_id, memory_key }
-- (chat memory is kept per session and role; cases per session)
create or replace function kb_context(p jsonb) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('role', coalesce(m.message ->> 'type', 'unknown'),
        'text', left(coalesce(m.message ->> 'content', m.message -> 'data' ->> 'content', ''), 1200)) order by m.id)
      from (select id, message from kb_chat_histories
            where session_id = coalesce(p ->> 'memory_key', p ->> 'session_id')
            order by id desc limit 8) m), '[]'::jsonb),
    'open_cases', coalesce((
      select jsonb_agg(jsonb_build_object('ref', ref, 'case_type', case_type, 'product', product) order by created_at)
      from kb_cases
      where session_id = p ->> 'session_id' and case_type in ('adverse_event', 'product_complaint')
        and created_at > now() - interval '1 day'), '[]'::jsonb),
    'mi_requests', (select count(*) from kb_cases where session_id = p ->> 'session_id' and case_type = 'mi_request'));
$$;

-- Create a case, or add follow-up information to it if the ref already exists.
-- p: { ref, case_type, session_id, channel, reporter_role, product, summary, details, turn_id }
create or replace function kb_upsert_case(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_new boolean;
begin
  insert into kb_cases as k (ref, case_type, due_at, session_id, channel, reporter_role, product, summary, details, source_turn_id)
  values (p ->> 'ref', p ->> 'case_type',
    now() + case when p ->> 'case_type' = 'mi_request' then interval '2 days' else interval '1 day' end,
    p ->> 'session_id', p ->> 'channel', p ->> 'reporter_role', nullif(lower(p ->> 'product'), ''),
    p ->> 'summary', coalesce(p -> 'details', '{}'), p ->> 'turn_id')
  on conflict (ref) do update set
    followups = k.followups || jsonb_build_array(jsonb_build_object('at', now(), 'summary', p ->> 'summary',
      'details', coalesce(p -> 'details', '{}'), 'turn_id', p ->> 'turn_id')),
    updated_at = now()
  returning (xmax = 0) into v_new;
  return jsonb_build_object('ref', p ->> 'ref', 'case_type', p ->> 'case_type', 'new', v_new);
end;
$$;

-- Medical Information request from the agent tool, with a per-chat limit.
-- p: { ref, session_id, channel, reporter_role, product, requester_name, contact, question, max }
create or replace function kb_request_mi(p jsonb) returns jsonb
language plpgsql as $$
declare
  v_count int;
begin
  select count(*) into v_count from kb_cases where session_id = p ->> 'session_id' and case_type = 'mi_request';
  if v_count >= coalesce((p ->> 'max')::int, 3) then
    return jsonb_build_object('success', false, 'message', 'This chat has reached the limit for Medical Information requests. Ask the person to call the Medical Information line instead.');
  end if;
  insert into kb_cases (ref, case_type, due_at, session_id, channel, reporter_role, product, summary, details)
  values (p ->> 'ref', 'mi_request', now() + interval '2 days', p ->> 'session_id', p ->> 'channel',
    p ->> 'reporter_role', nullif(lower(p ->> 'product'), ''), left(p ->> 'question', 500),
    jsonb_build_object('requester_name', p ->> 'requester_name', 'contact', p ->> 'contact', 'question', p ->> 'question'));
  return jsonb_build_object('success', true, 'ref', p ->> 'ref',
    'message', 'Medical Information request logged. The Medical Information team replies directly within 2 business days.');
end;
$$;

-- One audit row per question, plus any safety cases detected this turn.
-- p: { turn: {...}, cases: [ {ref, case_type, ...} ] }
create or replace function kb_record_turn(p jsonb) returns jsonb
language plpgsql as $$
declare
  t jsonb := p -> 'turn';
  c jsonb;
  v_cases jsonb := '[]';
begin
  insert into kb_turns (id, session_id, channel, role, question, standalone_question, answer, route, flags,
    sources, case_refs, tools, latency_ms, error)
  values (t ->> 'id', t ->> 'session_id', t ->> 'channel', t ->> 'role', t ->> 'question',
    t ->> 'standalone_question', t ->> 'answer', t ->> 'route', coalesce(t -> 'flags', '{}'),
    coalesce(t -> 'sources', '[]'), array(select jsonb_array_elements_text(coalesce(t -> 'case_refs', '[]'))),
    array(select jsonb_array_elements_text(coalesce(t -> 'tools', '[]'))),
    nullif(t ->> 'latency_ms', '')::int, nullif(t ->> 'error', ''))
  on conflict (id) do nothing;

  -- Conversation history for the next turn (kept per session and role).
  if found and coalesce(t ->> 'memory_key', '') <> '' then
    insert into kb_chat_histories (session_id, message) values
      (t ->> 'memory_key', jsonb_build_object('type', 'human', 'content', t ->> 'question')),
      (t ->> 'memory_key', jsonb_build_object('type', 'ai', 'content', t ->> 'answer'));
  end if;

  for c in select * from jsonb_array_elements(coalesce(p -> 'cases', '[]')) loop
    v_cases := v_cases || jsonb_build_array(kb_upsert_case(c || jsonb_build_object('turn_id', t ->> 'id')));
  end loop;
  return jsonb_build_object('turn_id', t ->> 'id', 'cases', v_cases);
end;
$$;

-- p: { turn_id, rating: 1 | -1, comment }
create or replace function kb_feedback(p jsonb) returns jsonb
language sql as $$
  update kb_turns set feedback = case when (p ->> 'rating')::int > 0 then 1 else -1 end,
    feedback_comment = left(p ->> 'comment', 1000), feedback_at = now()
  where id = p ->> 'turn_id'
  returning jsonb_build_object('ok', true, 'turn_id', id);
$$;

-- Weekly numbers for the insights report. p: { days }
create or replace function kb_weekly_stats(p jsonb) returns jsonb
language sql stable as $$
  with t as (
    select * from kb_turns
    where created_at > now() - make_interval(days => coalesce((p ->> 'days')::int, 7)) and channel <> 'eval'
  )
  select jsonb_build_object(
    'questions', (select count(*) from t),
    'sessions', (select count(distinct session_id) from t),
    'by_role', coalesce((select jsonb_object_agg(role, n) from (select role, count(*) n from t group by role) x), '{}'::jsonb),
    'by_route', coalesce((select jsonb_object_agg(route, n) from (select coalesce(route, 'unknown') route, count(*) n from t group by 1) x), '{}'::jsonb),
    'thumbs_up', (select count(*) from t where feedback = 1),
    'thumbs_down', (select count(*) from t where feedback = -1),
    'median_latency_ms', (select percentile_cont(0.5) within group (order by latency_ms) from t where latency_ms is not null),
    'p90_latency_ms', (select percentile_cont(0.9) within group (order by latency_ms) from t where latency_ms is not null),
    'top_documents', coalesce((select jsonb_agg(x order by x.n desc) from (
        select s ->> 'doc_code' as doc_code, max(s ->> 'title') as title, count(*) n
        from t, jsonb_array_elements(t.sources) s group by 1 order by 3 desc limit 5) x), '[]'::jsonb),
    'cases_opened', coalesce((select jsonb_object_agg(case_type, n) from (
        select case_type, count(*) n from kb_cases
        where created_at > now() - make_interval(days => coalesce((p ->> 'days')::int, 7))
          and session_id not like 'eval-%' group by 1) x), '{}'::jsonb),
    'cases_overdue', coalesce((select jsonb_agg(jsonb_build_object('ref', ref, 'case_type', case_type, 'due_at', due_at))
        from kb_cases where status = 'new' and due_at < now() and session_id not like 'eval-%'), '[]'::jsonb),
    'gap_questions', coalesce((select jsonb_agg(jsonb_build_object('question', coalesce(standalone_question, question),
        'route', route, 'feedback', feedback, 'comment', feedback_comment))
        from (select * from t where route = 'not_in_documents' or feedback = -1 order by created_at desc limit 60) g), '[]'::jsonb));
$$;

-- Lock down: no access for the public Supabase keys (n8n connects as the database owner).
alter table kb_documents enable row level security;
alter table kb_chunks enable row level security;
alter table kb_products enable row level security;
alter table kb_turns enable row level security;
alter table kb_cases enable row level security;
alter table kb_chat_histories enable row level security;
revoke all on kb_documents, kb_chunks, kb_products, kb_turns, kb_cases, kb_chat_histories from anon, authenticated;

revoke all on function kb_refresh_status(text) from public, anon, authenticated;
revoke all on function kb_index_document(jsonb) from public, anon, authenticated;
revoke all on function kb_delete_document(jsonb) from public, anon, authenticated;
revoke all on function kb_registry(jsonb) from public, anon, authenticated;
revoke all on function kb_search(jsonb) from public, anon, authenticated;
revoke all on function kb_read_section(jsonb) from public, anon, authenticated;
revoke all on function kb_lookup_product(jsonb) from public, anon, authenticated;
revoke all on function kb_replace_products(jsonb) from public, anon, authenticated;
revoke all on function kb_context(jsonb) from public, anon, authenticated;
revoke all on function kb_upsert_case(jsonb) from public, anon, authenticated;
revoke all on function kb_request_mi(jsonb) from public, anon, authenticated;
revoke all on function kb_record_turn(jsonb) from public, anon, authenticated;
revoke all on function kb_feedback(jsonb) from public, anon, authenticated;
revoke all on function kb_weekly_stats(jsonb) from public, anon, authenticated;

select jsonb_build_object(
  'tables', (select jsonb_agg(tablename order by tablename) from pg_tables where schemaname = 'public' and tablename like 'kb\_%'),
  'functions', (select jsonb_agg(proname order by proname) from pg_proc where proname like 'kb\_%'),
  'rls_off', (select coalesce(jsonb_agg(relname), '[]'::jsonb) from pg_class
              where relname like 'kb\_%' and relkind = 'r' and not relrowsecurity),
  'anon_can_search', has_function_privilege('anon', 'kb_search(jsonb)', 'execute'),
  'pgvector', (select extversion from pg_extension where extname = 'vector')) as setup_check;
