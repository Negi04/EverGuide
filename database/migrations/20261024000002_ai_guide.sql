-- =====================================================================
-- Phase 3 · AI Guide: knowledge base (pgvector), conversations,
-- messages, citations, usage metering and feedback
--
-- Security model
--   * Knowledge base: server-only (no client access at all).
--   * Conversations: users manage their own through RLS.
--   * Messages, citations, usage: written only by the server (service role),
--     so a user can't forge an "AI answer", a citation or their usage count.
--     Users can read their own.
--   * Feedback: users may rate only assistant messages in their own conversations.
-- =====================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------
create table public.knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  title        text not null check (char_length(title) between 3 and 200),
  domain       text not null check (domain in (
                 'career', 'interview', 'mental_wellness',
                 'physical_wellness', 'finance', 'personal_development')),
  source_name  text not null check (char_length(source_name) between 2 and 200),
  source_url   text check (source_url is null or source_url ~ '^https://'),
  license      text not null check (char_length(license) between 2 and 200),
  -- Only 'approved' documents are ever used to answer questions.
  status       text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  -- Hash of the source text, so re-ingesting an unchanged document is skipped.
  checksum     text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

create table public.knowledge_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index  integer not null check (chunk_index >= 0),
  heading      text check (char_length(heading) <= 200),
  content      text not null check (char_length(content) between 1 and 8000),
  -- gemini-embedding-2, 768 dimensions (normalised). Changing model or size
  -- means re-embedding every chunk.
  embedding    extensions.vector(768) not null,
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Approximate nearest-neighbour index for cosine similarity.
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Semantic search over approved documents. Called only by the server.
create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 6,
  min_similarity double precision default 0.5
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  title        text,
  source_name  text,
  source_url   text,
  heading      text,
  content      text,
  similarity   double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, d.id, d.title, d.source_name, d.source_url, c.heading, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'approved'
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

-- ---------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null default 'New conversation' check (char_length(title) between 1 and 120),
  domain           text not null default 'career' check (domain in (
                     'career', 'interview', 'mental_wellness',
                     'physical_wellness', 'finance', 'personal_development')),
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Lets messages reference (conversation, owner) together; see below.
  unique (id, user_id)
);

create index conversations_user_recent_idx on public.conversations (user_id, last_message_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null,
  user_id          uuid not null,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null check (char_length(content) between 1 and 20000),
  -- Assistant messages only: was the answer backed by retrieved sources?
  grounded         boolean,
  safety_flag      text check (safety_flag in ('crisis')),
  model            text,
  -- Retrieval and latency metrics for evaluation. Never store personal data here.
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  -- The message's owner must be the conversation's owner (enforced by the database).
  foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_user_idx on public.messages (user_id);

create table public.message_citations (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references public.messages (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  citation_number  integer not null check (citation_number between 1 and 20),
  -- Links to the retrieved chunk; snapshot fields keep the citation readable
  -- even if the knowledge base is edited later.
  chunk_id         uuid references public.knowledge_chunks (id) on delete set null,
  document_id      uuid references public.knowledge_documents (id) on delete set null,
  title            text not null,
  source_name      text not null,
  source_url       text,
  excerpt          text not null check (char_length(excerpt) <= 2000),
  similarity       real not null,
  unique (message_id, citation_number)
);

create index message_citations_message_idx on public.message_citations (message_id);
create index message_citations_user_idx on public.message_citations (user_id);

-- ---------------------------------------------------------------------
-- Usage metering
-- ---------------------------------------------------------------------
create table public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  message_id     uuid references public.messages (id) on delete set null,
  status         text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  model          text,
  input_tokens   integer check (input_tokens >= 0),
  output_tokens  integer check (output_tokens >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

create trigger ai_usage_set_updated_at
  before update on public.ai_usage
  for each row execute function public.set_updated_at();

-- Reserve one AI answer for a user if they are under their monthly limit.
-- The advisory lock makes check-then-insert atomic per user, so two requests
-- sent at the same moment cannot both squeeze past the limit.
create or replace function public.reserve_ai_message(p_user_id uuid, p_monthly_limit integer)
returns table (reservation_id uuid, used integer)
language plpgsql
set search_path = ''
as $$
declare
  v_used integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_used
  from public.ai_usage
  where user_id = p_user_id
    and status <> 'failed'
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  if v_used >= p_monthly_limit then
    return query select null::uuid, v_used;
    return;
  end if;

  insert into public.ai_usage (user_id) values (p_user_id) returning id into v_id;
  return query select v_id, v_used + 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Feedback on answers
-- ---------------------------------------------------------------------
create table public.ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      text not null check (rating in ('helpful', 'not_helpful')),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

create index ai_feedback_created_idx on public.ai_feedback (created_at desc);

create trigger ai_feedback_set_updated_at
  before update on public.ai_feedback
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks    enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.message_citations   enable row level security;
alter table public.ai_usage            enable row level security;
alter table public.ai_feedback         enable row level security;

-- knowledge_documents, knowledge_chunks: no policies = server only.

-- conversations: full control over your own
create policy "conversations: read own"
  on public.conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "conversations: create own"
  on public.conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "conversations: update own"
  on public.conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "conversations: delete own"
  on public.conversations for delete to authenticated
  using (user_id = (select auth.uid()));

-- messages, citations, usage: read your own; only the server writes
create policy "messages: read own"
  on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "message_citations: read own"
  on public.message_citations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_usage: read own"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- feedback: only on assistant messages that belong to you
create policy "ai_feedback: read own"
  on public.ai_feedback for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_feedback: create own"
  on public.ai_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.user_id = (select auth.uid()) and m.role = 'assistant'
    )
  );
create policy "ai_feedback: update own"
  on public.ai_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- =====================================================================
-- Privileges: RLS decides which rows, grants decide which columns
-- =====================================================================
revoke all on public.knowledge_documents, public.knowledge_chunks, public.conversations,
              public.messages, public.message_citations, public.ai_usage, public.ai_feedback
  from anon, authenticated;

grant select, delete on public.conversations to authenticated;
grant insert (user_id, title, domain) on public.conversations to authenticated;
grant update (title, domain) on public.conversations to authenticated;

grant select on public.messages, public.message_citations, public.ai_usage, public.ai_feedback
  to authenticated;
grant insert (message_id, user_id, rating, comment) on public.ai_feedback to authenticated;
grant update (rating, comment) on public.ai_feedback to authenticated;

revoke execute on function public.match_knowledge_chunks(extensions.vector, integer, double precision)
  from public, anon, authenticated;
revoke execute on function public.reserve_ai_message(uuid, integer) from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(extensions.vector, integer, double precision)
  to service_role;
grant execute on function public.reserve_ai_message(uuid, integer) to service_role;

-- Tidy-up from Phase 2: has_role only makes sense for signed-in users.
revoke execute on function public.has_role(public.app_role) from public, anon;
