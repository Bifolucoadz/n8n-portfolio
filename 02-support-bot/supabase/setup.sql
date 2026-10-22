-- Copperline Support Bot: run once in the Supabase SQL editor.

create extension if not exists vector;

-- Knowledge chunks, written by Support Bot 1 and searched by the agent.
create table if not exists documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

create index if not exists documents_file_id_idx on documents ((metadata->>'file_id'));

-- Called by the n8n Supabase Vector Store node.
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int default null,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Chat memory for the Postgres Chat Memory node (same shape n8n creates on its own).
create table if not exists n8n_chat_histories (
  id serial primary key,
  session_id varchar(255) not null,
  message jsonb not null
);

create index if not exists n8n_chat_histories_session_idx on n8n_chat_histories (session_id);

-- No policies: the public anon key can read nothing. n8n uses the secret key and the
-- database password, which bypass RLS.
alter table documents enable row level security;
alter table n8n_chat_histories enable row level security;
