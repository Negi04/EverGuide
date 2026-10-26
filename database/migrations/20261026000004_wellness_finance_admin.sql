-- =====================================================================
-- Phase 5 · Wellness (journal, habits), Finance (budgets, savings goals),
--           Resource library, and Admin portal support
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
--
-- Security model
--   * Journal entries: only the writer can read them. No admin screen,
--     analytics query or AI feature reads this table.
--   * Habits, check-ins, budgets, budget items: users manage their own (RLS).
--   * Savings goals: users manage their own; the balance comes from a ledger
--     of entries written only through record_savings_entry(), which locks the
--     goal so concurrent withdrawals can't take it below zero.
--   * Learning resources: anyone can read published ones; only the server
--     (for admins) writes them. Bookmarks are private.
--   * Admin functions: callable by the server (service role) only, after it has
--     checked the caller is an admin. They return counts, never content.
--
-- Money is stored as integer paise (1 rupee = 100 paise): floating-point
-- numbers can't represent amounts like 0.1 exactly.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Wellness: private journal
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- The day in the writer's own time zone, chosen by them.
  entry_date  date not null,
  mood        smallint check (mood between 1 and 5),
  title       text check (char_length(title) <= 120),
  body        text not null check (char_length(body) between 1 and 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc, created_at desc);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Wellness: habits and daily check-ins
-- ---------------------------------------------------------------------
create table public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  -- How many days a week the person aims for (7 = every day).
  target_per_week  smallint not null default 7 check (target_per_week between 1 and 7),
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (id, user_id)
);

create index habits_user_idx on public.habits (user_id, created_at);

create table public.habit_checkins (
  habit_id      uuid not null,
  user_id       uuid not null,
  -- The day in the person's own time zone. The server works out "today".
  checkin_date  date not null,
  created_at    timestamptz not null default now(),
  primary key (habit_id, checkin_date),
  -- Composite key: a check-in can only point at a habit owned by the same user.
  -- "Not in the future" is checked by the server, in the person's time zone. A CHECK
  -- using current_date would also re-run when restoring a backup and reject old rows.
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create index habit_checkins_user_date_idx on public.habit_checkins (user_id, checkin_date desc);

-- ---------------------------------------------------------------------
-- Finance: monthly budgets
-- ---------------------------------------------------------------------
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- Always the first day of the month.
  month         date not null check (extract(day from month) = 1),
  income_paise  bigint not null default 0 check (income_paise between 0 and 100000000000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, month),
  unique (id, user_id)
);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.budget_items (
  id             uuid primary key default gen_random_uuid(),
  budget_id      uuid not null,
  user_id        uuid not null,
  label          text not null check (char_length(label) between 1 and 80),
  -- needs / wants / savings, as in the 50/30/20 rule of thumb.
  kind           text not null check (kind in ('need', 'want', 'saving')),
  planned_paise  bigint not null default 0 check (planned_paise between 0 and 100000000000),
  spent_paise    bigint not null default 0 check (spent_paise between 0 and 100000000000),
  position       smallint not null default 0,
  created_at     timestamptz not null default now(),
  foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade
);

create index budget_items_budget_idx on public.budget_items (budget_id, position);

-- ---------------------------------------------------------------------
-- Finance: savings goals with a ledger of entries
-- ---------------------------------------------------------------------
create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  target_paise  bigint not null check (target_paise between 100 and 100000000000),
  target_date   date,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);

create index savings_goals_user_idx on public.savings_goals (user_id, created_at);

create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

-- Deposits are positive, withdrawals negative. The balance is the sum, so the
-- history always explains the number (the way bank statements work).
create table public.savings_entries (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null,
  user_id       uuid not null,
  amount_paise  bigint not null check (amount_paise <> 0 and abs(amount_paise) <= 100000000000),
  note          text check (char_length(note) <= 120),
  entry_date    date not null,
  created_at    timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete cascade
);

create index savings_entries_goal_idx on public.savings_entries (goal_id, entry_date desc, created_at desc);

-- Record a deposit or withdrawal. Locks the goal row so two withdrawals at the
-- same moment are checked one after the other against the real balance.
create or replace function public.record_savings_entry(
  p_goal_id uuid,
  p_amount_paise bigint,
  p_note text default null,
  p_entry_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.savings_goals;
  v_balance bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in to record savings.' using errcode = '28000';
  end if;

  select * into v_goal from public.savings_goals
    where id = p_goal_id and user_id = v_user
    for update;
  if v_goal.id is null then
    raise exception 'Savings goal not found.' using errcode = 'P0002';
  end if;
  if v_goal.archived_at is not null then
    raise exception 'This goal is archived.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount_paise), 0) into v_balance
    from public.savings_entries where goal_id = p_goal_id;
  if v_balance + p_amount_paise < 0 then
    raise exception 'You can''t withdraw more than you''ve saved for this goal.' using errcode = 'P0001';
  end if;

  insert into public.savings_entries (goal_id, user_id, amount_paise, note, entry_date)
  values (p_goal_id, v_user, p_amount_paise, nullif(trim(p_note), ''),
          coalesce(p_entry_date, current_date))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Resource library
-- ---------------------------------------------------------------------
create table public.learning_resources (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  title             text not null check (char_length(title) between 3 and 160),
  summary           text not null check (char_length(summary) between 10 and 600),
  kind              text not null check (kind in ('article', 'video', 'course', 'tool')),
  domain            text not null check (domain in (
                      'career', 'interview', 'mental_wellness',
                      'physical_wellness', 'finance', 'personal_development')),
  url               text not null check (url ~ '^https://' and char_length(url) <= 500),
  source_name       text not null check (char_length(source_name) between 2 and 120),
  -- Set by the server for YouTube links, so the page can embed the video.
  youtube_id        text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  duration_minutes  integer check (duration_minutes between 1 and 6000),
  level             text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  status            text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at      timestamptz,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Full-text search over the title (weighted higher) and summary.
  search            tsvector generated always as (
                      setweight(to_tsvector('english', title), 'A') ||
                      setweight(to_tsvector('english', summary), 'B')
                    ) stored,
  check ((status = 'published') = (published_at is not null))
);

create index learning_resources_search_idx on public.learning_resources using gin (search);
create index learning_resources_published_idx on public.learning_resources (domain, published_at desc)
  where status = 'published';

create trigger learning_resources_set_updated_at
  before update on public.learning_resources
  for each row execute function public.set_updated_at();

create table public.resource_bookmarks (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  resource_id  uuid not null references public.learning_resources (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- ---------------------------------------------------------------------
-- Admin: overview counts and role management (server only)
-- ---------------------------------------------------------------------

-- Headline numbers for the admin dashboard. Counts only: no names, no content,
-- and nothing from the journal.
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'newLast7Days', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
      'newLast30Days', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
      'onboarded', (select count(*) from public.user_preferences where onboarding_completed_at is not null)
    ),
    'ai', jsonb_build_object(
      'messagesThisMonth', (select count(*) from public.ai_usage
                            where status = 'completed' and created_at >= date_trunc('month', now())),
      'failedThisMonth', (select count(*) from public.ai_usage
                          where status = 'failed' and created_at >= date_trunc('month', now())),
      'helpfulFeedback', (select count(*) from public.ai_feedback where rating = 'helpful'),
      'notHelpfulFeedback', (select count(*) from public.ai_feedback where rating = 'not_helpful')
    ),
    'mentors', jsonb_build_object(
      'verified', (select count(*) from public.mentor_profiles where verification_status = 'verified'),
      'pending', (select count(*) from public.mentor_profiles where verification_status = 'pending')
    ),
    'bookings', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 from (select status, count(*) as n from public.bookings group by status) b),
    'content', jsonb_build_object(
      'publishedResources', (select count(*) from public.learning_resources where status = 'published'),
      'approvedKnowledgeDocuments', (select count(*) from public.knowledge_documents where status = 'approved')
    )
  );
$$;

-- New sign-ups per week for the last p_weeks weeks, including weeks with none.
create or replace function public.admin_signups_by_week(p_weeks integer default 12)
returns table (week_start date, signups bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => least(greatest(p_weeks, 1), 52) - 1),
      date_trunc('week', now()),
      interval '1 week'
    )::date as week_start
  )
  select w.week_start, count(p.id)
  from weeks w
  left join public.profiles p
    on p.created_at >= w.week_start and p.created_at < w.week_start + 7
  group by w.week_start
  order by w.week_start;
$$;

-- Grant or remove the admin role. The caller must be an admin and can't remove
-- themselves, so someone always remains. The transaction-level lock makes two
-- admins removing each other at the same moment run one after the other: the
-- second finds it is no longer an admin.
create or replace function public.set_admin_role(p_actor uuid, p_target uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('everguide:admin-roles'));

  if not exists (select 1 from public.user_roles where user_id = p_actor and role = 'admin') then
    raise exception 'Only admins can change admin roles.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_target, 'admin', p_actor)
    on conflict (user_id, role) do nothing;
  else
    if p_target = p_actor then
      raise exception 'You can''t remove your own admin role. Ask another admin.' using errcode = 'P0001';
    end if;
    delete from public.user_roles where user_id = p_target and role = 'admin';
  end if;
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.journal_entries     enable row level security;
alter table public.habits              enable row level security;
alter table public.habit_checkins      enable row level security;
alter table public.budgets             enable row level security;
alter table public.budget_items        enable row level security;
alter table public.savings_goals       enable row level security;
alter table public.savings_entries     enable row level security;
alter table public.learning_resources  enable row level security;
alter table public.resource_bookmarks  enable row level security;

-- Personal tables: full control over your own rows, nothing else.
create policy "journal_entries: read own" on public.journal_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "journal_entries: create own" on public.journal_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "journal_entries: update own" on public.journal_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "journal_entries: delete own" on public.journal_entries for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "habits: read own" on public.habits for select to authenticated
  using (user_id = (select auth.uid()));
create policy "habits: create own" on public.habits for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "habits: update own" on public.habits for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "habits: delete own" on public.habits for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "habit_checkins: read own" on public.habit_checkins for select to authenticated
  using (user_id = (select auth.uid()));
create policy "habit_checkins: create own" on public.habit_checkins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "habit_checkins: delete own" on public.habit_checkins for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "budgets: read own" on public.budgets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "budgets: create own" on public.budgets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "budgets: update own" on public.budgets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budgets: delete own" on public.budgets for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "budget_items: read own" on public.budget_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "budget_items: create own" on public.budget_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "budget_items: update own" on public.budget_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budget_items: delete own" on public.budget_items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "savings_goals: read own" on public.savings_goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "savings_goals: create own" on public.savings_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "savings_goals: update own" on public.savings_goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "savings_goals: delete own" on public.savings_goals for delete to authenticated
  using (user_id = (select auth.uid()));

-- Savings entries: read and delete (to correct a mistake) your own; new entries
-- only through record_savings_entry().
create policy "savings_entries: read own" on public.savings_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "savings_entries: delete own" on public.savings_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- Resources: published ones are public; the server writes.
create policy "learning_resources: read published" on public.learning_resources for select to anon, authenticated
  using (status = 'published');

create policy "resource_bookmarks: read own" on public.resource_bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "resource_bookmarks: create own" on public.resource_bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "resource_bookmarks: delete own" on public.resource_bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- Privileges: RLS decides which rows, grants decide which columns
-- =====================================================================
revoke all on public.journal_entries, public.habits, public.habit_checkins, public.budgets,
              public.budget_items, public.savings_goals, public.savings_entries,
              public.learning_resources, public.resource_bookmarks
  from anon, authenticated;

grant select, delete on public.journal_entries, public.habits, public.habit_checkins,
                        public.budgets, public.budget_items, public.savings_goals,
                        public.savings_entries, public.resource_bookmarks
  to authenticated;
grant insert (user_id, entry_date, mood, title, body) on public.journal_entries to authenticated;
grant update (entry_date, mood, title, body) on public.journal_entries to authenticated;
grant insert (user_id, name, target_per_week) on public.habits to authenticated;
grant update (name, target_per_week, archived_at) on public.habits to authenticated;
grant insert (habit_id, user_id, checkin_date) on public.habit_checkins to authenticated;
grant insert (user_id, month, income_paise) on public.budgets to authenticated;
grant update (income_paise) on public.budgets to authenticated;
grant insert (budget_id, user_id, label, kind, planned_paise, spent_paise, position)
  on public.budget_items to authenticated;
grant update (label, kind, planned_paise, spent_paise, position) on public.budget_items to authenticated;
grant insert (user_id, name, target_paise, target_date) on public.savings_goals to authenticated;
grant update (name, target_paise, target_date, archived_at) on public.savings_goals to authenticated;
grant insert (user_id, resource_id) on public.resource_bookmarks to authenticated;

grant select on public.learning_resources to anon, authenticated;

revoke execute on function public.record_savings_entry(uuid, bigint, text, date) from public, anon;
grant execute on function public.record_savings_entry(uuid, bigint, text, date) to authenticated;

revoke execute on function public.admin_overview() from public, anon, authenticated;
revoke execute on function public.admin_signups_by_week(integer) from public, anon, authenticated;
revoke execute on function public.set_admin_role(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
grant execute on function public.admin_signups_by_week(integer) to service_role;
grant execute on function public.set_admin_role(uuid, uuid, boolean) to service_role;

commit;
