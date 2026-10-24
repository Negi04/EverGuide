-- =====================================================================
-- Phase 2 · Identity, roles, onboarding, notifications, audit, contact
--
-- Security model
--   * Every table has Row Level Security enabled.
--   * Browsers use the anon/publishable key and only see rows the
--     policies allow (normally: their own rows).
--   * Privileged writes (roles, audit events, contact messages) are made
--     by the Express server with the service-role key, which bypasses RLS.
--   * Column-level grants stop users editing columns they must not touch.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: one row per auth user (auth.users holds email + password)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 80),
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  timezone    text not null default 'Asia/Kolkata',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- user_roles: separate from profiles so users can never grant themselves
-- a role. A user may hold several roles (e.g. mentor + admin).
-- ---------------------------------------------------------------------
create type public.app_role as enum ('user', 'mentor', 'admin');

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, role)
);

-- Used by RLS policies in later phases. SECURITY DEFINER lets it read
-- user_roles regardless of the caller's own policies.
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = check_role
  );
$$;

-- ---------------------------------------------------------------------
-- user_preferences: onboarding answers. Values are checked against fixed
-- lists (text + CHECK is easier to evolve than a Postgres enum).
-- ---------------------------------------------------------------------
create table public.user_preferences (
  user_id                  uuid primary key references public.profiles (id) on delete cascade,
  life_stage               text check (life_stage in (
                             'school_student', 'college_student', 'recent_graduate',
                             'early_career', 'mid_career', 'career_changer', 'other')),
  primary_goals            text[] not null default '{}'
                             check (cardinality(primary_goals) <= 5),
  target_career            text check (char_length(target_career) <= 120),
  preferred_domains        text[] not null default '{}'
                             check (preferred_domains <@ array[
                               'career', 'interview', 'mental_wellness',
                               'physical_wellness', 'finance', 'personal_development']::text[]),
  skill_level              text check (skill_level in ('beginner', 'intermediate', 'advanced')),
  onboarding_completed_at  timestamptz,
  updated_at               timestamptz not null default now()
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- notifications: in-app notifications. read_at (not a boolean) records when.
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (char_length(type) <= 64),
  title       text not null check (char_length(title) <= 160),
  body        text check (char_length(body) <= 1000),
  link_path   text check (link_path is null or link_path ~ '^/'),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- audit_events: append-only record of sensitive actions (written by the
-- server only; read by admins through the server API).
-- ---------------------------------------------------------------------
create table public.audit_events (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (char_length(action) <= 64),
  target_type  text check (char_length(target_type) <= 64),
  target_id    text check (char_length(target_id) <= 128),
  metadata     jsonb not null default '{}'::jsonb,
  request_id   text,
  created_at   timestamptz not null default now()
);

create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- contact_messages: submitted through the server (validated + rate limited)
-- ---------------------------------------------------------------------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (char_length(email) <= 254),
  topic       text not null check (topic in ('general', 'mentorship', 'partnerships', 'support', 'privacy')),
  message     text not null check (char_length(message) between 20 and 2000),
  status      text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at  timestamptz not null default now()
);

create index contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

-- ---------------------------------------------------------------------
-- Signup trigger: create profile, preferences and the default 'user' role
-- in the same transaction as the auth user.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'EverGuide member'
  ), 80);
begin
  insert into public.profiles (id, full_name) values (new.id, display_name);
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- (select auth.uid()) is evaluated once per query instead of per row.
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.user_preferences enable row level security;
alter table public.notifications    enable row level security;
alter table public.audit_events     enable row level security;
alter table public.contact_messages enable row level security;

-- profiles: read and edit your own row
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_roles: read your own roles; no write policies (server only)
create policy "user_roles: read own"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- user_preferences: read and edit your own row (created by the trigger)
create policy "user_preferences: read own"
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_preferences: update own"
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifications: read your own and mark them read
create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_events, contact_messages: RLS on with no policies = no client access.

-- =====================================================================
-- Column-level privileges: RLS decides WHICH rows, grants decide WHICH
-- columns. Users may only change the fields that are theirs to change.
-- =====================================================================
revoke all on public.profiles, public.user_roles, public.user_preferences,
              public.notifications, public.audit_events, public.contact_messages
  from anon, authenticated;

grant select on public.profiles, public.user_roles, public.user_preferences, public.notifications
  to authenticated;
grant update (full_name, avatar_url, timezone) on public.profiles to authenticated;
grant update (life_stage, primary_goals, target_career, preferred_domains,
              skill_level, onboarding_completed_at)
  on public.user_preferences to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;
