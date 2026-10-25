-- =====================================================================
-- Phase 4 · Career Studio (goals, milestones, resumes, interview practice)
--           and the Mentor marketplace (profiles, verification,
--           availability, bookings, reviews)
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
--
-- Security model
--   * Goals, milestones, saved questions: users manage their own (RLS).
--   * Resumes, analyses, practice feedback: written by the server only (files
--     live in a private bucket; AI output can't be forged). Users read their own.
--   * Mentor verification status: changed by the server for admins only.
--   * Bookings and reviews: changed only through SECURITY DEFINER functions that
--     enforce the rules (availability, no overlaps, cancellation window,
--     reviews only after a completed session) in one transaction.
-- =====================================================================

begin;

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Career roadmap: goals and milestones
-- ---------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  description   text check (char_length(description) <= 1000),
  category      text not null default 'career'
                  check (category in ('career', 'skill', 'education', 'wellbeing', 'finance', 'other')),
  target_date   date,
  status        text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  -- completed_at is set exactly when the goal is completed.
  check ((status = 'completed') = (completed_at is not null))
);

create index goals_user_status_idx on public.goals (user_id, status, created_at desc);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null,
  user_id       uuid not null,
  title         text not null check (char_length(title) between 2 and 160),
  notes         text check (char_length(notes) <= 1000),
  target_date   date,
  position      integer not null default 0 check (position >= 0),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- A milestone always belongs to a goal owned by the same user.
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create index milestones_goal_position_idx on public.milestones (goal_id, position);

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Resume analyser (files in a private storage bucket)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create table public.resumes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  file_name       text not null check (char_length(file_name) between 1 and 200),
  storage_path    text not null unique,
  size_bytes      integer not null check (size_bytes between 1 and 5242880),
  page_count      integer not null check (page_count between 1 and 20),
  extracted_text  text not null check (char_length(extracted_text) between 1 and 60000),
  created_at      timestamptz not null default now(),
  unique (id, user_id)
);

create index resumes_user_created_idx on public.resumes (user_id, created_at desc);

create table public.resume_analyses (
  id               uuid primary key default gen_random_uuid(),
  resume_id        uuid not null,
  user_id          uuid not null,
  target_role      text check (char_length(target_role) <= 120),
  job_description  text check (char_length(job_description) <= 10000),
  report           jsonb not null,
  model            text not null,
  created_at       timestamptz not null default now(),
  foreign key (resume_id, user_id) references public.resumes (id, user_id) on delete cascade
);

create index resume_analyses_resume_idx on public.resume_analyses (resume_id, created_at desc);

-- ---------------------------------------------------------------------
-- Interview practice
-- ---------------------------------------------------------------------
create table public.interview_questions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,120}$'),
  category    text not null check (category in ('behavioural', 'technical', 'situational')),
  role        text not null check (role in (
                'general', 'software_engineer', 'data_analyst', 'product_manager', 'designer', 'marketing')),
  difficulty  text not null check (difficulty in ('foundation', 'intermediate', 'advanced')),
  prompt      text not null check (char_length(prompt) between 10 and 500),
  guidance    text not null check (char_length(guidance) between 10 and 2000),
  status      text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index interview_questions_filter_idx on public.interview_questions (status, role, category);

create trigger interview_questions_set_updated_at
  before update on public.interview_questions
  for each row execute function public.set_updated_at();

create table public.saved_questions (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  question_id  uuid not null references public.interview_questions (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.practice_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  question_id  uuid not null references public.interview_questions (id) on delete cascade,
  answer       text not null check (char_length(answer) between 20 and 5000),
  feedback     jsonb,
  model        text,
  created_at   timestamptz not null default now()
);

create index practice_attempts_user_question_idx on public.practice_attempts (user_id, question_id, created_at desc);

-- ---------------------------------------------------------------------
-- Mentors: profiles and verification
-- ---------------------------------------------------------------------
create table public.mentor_profiles (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  headline             text not null check (char_length(headline) between 10 and 120),
  bio                  text not null check (char_length(bio) between 50 and 2000),
  job_title            text check (char_length(job_title) <= 120),
  company              text check (char_length(company) <= 120),
  years_experience     integer not null check (years_experience between 0 and 60),
  expertise            text[] not null check (
                         cardinality(expertise) between 1 and 6
                         and expertise <@ array[
                           'software_engineering', 'data_analytics', 'product_management', 'design',
                           'marketing', 'finance', 'consulting', 'career_switching',
                           'interview_preparation', 'higher_studies', 'entrepreneurship', 'wellbeing']::text[]),
  languages            text[] not null default '{English}' check (cardinality(languages) between 1 and 6),
  session_minutes      integer not null default 30 check (session_minutes in (30, 45, 60)),
  is_accepting         boolean not null default true,
  -- Only the server (for admins) changes this. "Verified" means a person reviewed evidence.
  verification_status  text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((verification_status = 'verified') = (verified_at is not null))
);

create index mentor_profiles_verified_idx on public.mentor_profiles (verification_status, is_accepting);

create trigger mentor_profiles_set_updated_at
  before update on public.mentor_profiles
  for each row execute function public.set_updated_at();

create table public.mentor_verifications (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid not null references public.mentor_profiles (user_id) on delete cascade,
  evidence_url    text not null check (evidence_url ~ '^https://' and char_length(evidence_url) <= 500),
  evidence_notes  text check (char_length(evidence_notes) <= 2000),
  status          text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewer_id     uuid references public.profiles (id) on delete set null,
  review_notes    text check (char_length(review_notes) <= 2000),
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  check ((status = 'pending') = (reviewed_at is null))
);

-- At most one open application per mentor.
create unique index mentor_verifications_one_pending_idx
  on public.mentor_verifications (mentor_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- Weekly availability (in the mentor's own time zone, profiles.timezone)
-- ---------------------------------------------------------------------
create table public.mentor_availability (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentor_profiles (user_id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  check (end_time > start_time),
  -- Windows on the same day may not overlap.
  constraint mentor_availability_no_overlap exclude using gist (
    mentor_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time) with &&
  )
);

-- ---------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null references public.mentor_profiles (user_id) on delete cascade,
  mentee_id      uuid not null references public.profiles (id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  -- A confirmed booking whose end time has passed counts as completed.
  status         text not null default 'requested'
                   check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  topic          text not null check (char_length(topic) between 10 and 500),
  meeting_url    text check (meeting_url is null or (meeting_url ~ '^https://' and char_length(meeting_url) <= 500)),
  cancelled_by   uuid references public.profiles (id) on delete set null,
  status_reason  text check (char_length(status_reason) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  check (mentor_id <> mentee_id),
  -- The core guarantee: no overlapping active bookings for a mentor, or for a mentee,
  -- even when two requests arrive at the same moment.
  constraint bookings_no_mentor_overlap exclude using gist (
    mentor_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('requested', 'confirmed')),
  constraint bookings_no_mentee_overlap exclude using gist (
    mentee_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('requested', 'confirmed'))
);

create index bookings_mentor_starts_idx on public.bookings (mentor_id, starts_at);
create index bookings_mentee_starts_idx on public.bookings (mentee_id, starts_at);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.mentor_reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings (id) on delete cascade,
  mentor_id   uuid not null references public.mentor_profiles (user_id) on delete cascade,
  mentee_id   uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);

create index mentor_reviews_mentor_idx on public.mentor_reviews (mentor_id, created_at desc);

-- ---------------------------------------------------------------------
-- Booking rules (SECURITY DEFINER: they act on rows the caller can't write
-- directly, so each one checks the caller with auth.uid() first)
-- ---------------------------------------------------------------------

-- Bookable start times for a mentor, computed in the mentor's time zone so
-- daylight-saving changes are handled by Postgres. Only times at least 2 hours
-- away, up to p_days ahead, that don't overlap an active booking.
create or replace function public.mentor_open_slots(
  p_mentor_id uuid,
  p_days integer default 14,
  p_exclude_booking uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with mentor as (
    select mp.user_id, mp.session_minutes, p.timezone
    from public.mentor_profiles mp
    join public.profiles p on p.id = mp.user_id
    where mp.user_id = p_mentor_id
      and mp.verification_status = 'verified'
      and mp.is_accepting
  ),
  days as (
    select (now() at time zone mentor.timezone)::date + offset_days as local_date
    from mentor, generate_series(0, least(greatest(p_days, 1), 30)) as offset_days
  ),
  candidates as (
    select
      (slot_local at time zone mentor.timezone) as slot_start,
      make_interval(mins => mentor.session_minutes) as length
    from mentor
    cross join days
    join public.mentor_availability a
      on a.mentor_id = mentor.user_id and a.weekday = extract(isodow from days.local_date)
    cross join lateral generate_series(
      days.local_date + a.start_time,
      days.local_date + a.end_time - make_interval(mins => mentor.session_minutes),
      make_interval(mins => mentor.session_minutes)
    ) as slot_local
  )
  select c.slot_start, c.slot_start + c.length
  from candidates c
  where c.slot_start > now() + interval '2 hours'
    and not exists (
      select 1 from public.bookings b
      where b.mentor_id = p_mentor_id
        and b.status in ('requested', 'confirmed')
        and b.id is distinct from p_exclude_booking
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(c.slot_start, c.slot_start + c.length, '[)')
    )
  order by 1;
$$;

create or replace function public.request_booking(p_mentor_id uuid, p_starts_at timestamptz, p_topic text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ends_at timestamptz;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Please sign in to book a session.' using errcode = '28000';
  end if;
  if v_user = p_mentor_id then
    raise exception 'You can''t book a session with yourself.' using errcode = 'P0001';
  end if;

  select s.ends_at into v_ends_at
  from public.mentor_open_slots(p_mentor_id, 30) s
  where s.starts_at = p_starts_at;
  if v_ends_at is null then
    raise exception 'That time is not available. Please choose another slot.' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (mentor_id, mentee_id, starts_at, ends_at, topic)
    values (p_mentor_id, v_user, p_starts_at, v_ends_at, p_topic)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'That time was just booked, or overlaps another of your sessions.' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, type, title, body, link_path)
  values (p_mentor_id, 'booking.requested', 'New session request',
          'Someone has requested a mentoring session with you.', '/app/mentors/sessions');
  return v_id;
end;
$$;

create or replace function public.respond_to_booking(
  p_booking_id uuid,
  p_accept boolean,
  p_meeting_url text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.mentor_id is distinct from auth.uid() then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'requested' or v_booking.starts_at <= now() then
    raise exception 'This request can no longer be answered.' using errcode = 'P0001';
  end if;

  if p_accept then
    if p_meeting_url is null or p_meeting_url !~ '^https://' then
      raise exception 'Add an https meeting link to confirm the session.' using errcode = 'P0001';
    end if;
    update public.bookings set status = 'confirmed', meeting_url = p_meeting_url where id = p_booking_id;
    insert into public.notifications (user_id, type, title, body, link_path)
    values (v_booking.mentee_id, 'booking.confirmed', 'Session confirmed',
            'Your mentor confirmed your session.', '/app/mentors/sessions');
  else
    update public.bookings set status = 'declined', status_reason = left(p_reason, 500) where id = p_booking_id;
    insert into public.notifications (user_id, type, title, body, link_path)
    values (v_booking.mentee_id, 'booking.declined', 'Session request declined',
            'Your mentor can''t take this session. You can request another time.', '/app/mentors/sessions');
  end if;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_booking public.bookings;
  v_other uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_user not in (v_booking.mentor_id, v_booking.mentee_id) then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('requested', 'confirmed') or v_booking.starts_at <= now() then
    raise exception 'This session can no longer be cancelled.' using errcode = 'P0001';
  end if;
  -- Mentees can't cancel a confirmed session at the last minute; mentors can, with a reason.
  if v_user = v_booking.mentee_id and v_booking.status = 'confirmed'
     and v_booking.starts_at < now() + interval '12 hours' then
    raise exception 'Confirmed sessions can''t be cancelled less than 12 hours before they start. Please message your mentor.'
      using errcode = 'P0001';
  end if;
  if v_user = v_booking.mentor_id and v_booking.status = 'confirmed' and coalesce(trim(p_reason), '') = '' then
    raise exception 'Please give your mentee a reason for cancelling.' using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_by = v_user, status_reason = left(p_reason, 500)
  where id = p_booking_id;

  v_other := case when v_user = v_booking.mentor_id then v_booking.mentee_id else v_booking.mentor_id end;
  insert into public.notifications (user_id, type, title, body, link_path)
  values (v_other, 'booking.cancelled', 'Session cancelled',
          'A mentoring session was cancelled.', '/app/mentors/sessions');
end;
$$;

create or replace function public.reschedule_booking(p_booking_id uuid, p_new_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_ends_at timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.mentee_id is distinct from auth.uid() then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('requested', 'confirmed') or v_booking.starts_at < now() + interval '12 hours' then
    raise exception 'This session can no longer be rescheduled.' using errcode = 'P0001';
  end if;

  select s.ends_at into v_ends_at
  from public.mentor_open_slots(v_booking.mentor_id, 30, p_booking_id) s
  where s.starts_at = p_new_starts_at;
  if v_ends_at is null then
    raise exception 'That time is not available. Please choose another slot.' using errcode = 'P0001';
  end if;

  begin
    -- A new time needs the mentor's confirmation again.
    update public.bookings
    set starts_at = p_new_starts_at, ends_at = v_ends_at, status = 'requested', meeting_url = null
    where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'That time was just booked, or overlaps another of your sessions.' using errcode = 'P0001';
  end;

  insert into public.notifications (user_id, type, title, body, link_path)
  values (v_booking.mentor_id, 'booking.rescheduled', 'Session moved',
          'A mentee asked to move their session to a new time.', '/app/mentors/sessions');
end;
$$;

create or replace function public.submit_mentor_review(p_booking_id uuid, p_rating smallint, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null or v_booking.mentee_id is distinct from auth.uid() then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  -- Only sessions that were confirmed and have finished can be reviewed.
  if v_booking.status <> 'confirmed' or v_booking.ends_at > now() then
    raise exception 'You can review a session after it has taken place.' using errcode = 'P0001';
  end if;

  begin
    insert into public.mentor_reviews (booking_id, mentor_id, mentee_id, rating, comment)
    values (p_booking_id, v_booking.mentor_id, v_booking.mentee_id, p_rating, nullif(trim(p_comment), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You have already reviewed this session.' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.goals                enable row level security;
alter table public.milestones           enable row level security;
alter table public.resumes              enable row level security;
alter table public.resume_analyses      enable row level security;
alter table public.interview_questions  enable row level security;
alter table public.saved_questions      enable row level security;
alter table public.practice_attempts    enable row level security;
alter table public.mentor_profiles      enable row level security;
alter table public.mentor_verifications enable row level security;
alter table public.mentor_availability  enable row level security;
alter table public.bookings             enable row level security;
alter table public.mentor_reviews       enable row level security;

-- goals, milestones: full control over your own
create policy "goals: read own" on public.goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "goals: create own" on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "goals: update own" on public.goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: delete own" on public.goals for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "milestones: read own" on public.milestones for select to authenticated
  using (user_id = (select auth.uid()));
create policy "milestones: create own" on public.milestones for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "milestones: update own" on public.milestones for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "milestones: delete own" on public.milestones for delete to authenticated
  using (user_id = (select auth.uid()));

-- resumes, analyses, practice attempts: read (and for attempts, delete) your own; the server writes
create policy "resumes: read own" on public.resumes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "resume_analyses: read own" on public.resume_analyses for select to authenticated
  using (user_id = (select auth.uid()));
create policy "practice_attempts: read own" on public.practice_attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "practice_attempts: delete own" on public.practice_attempts for delete to authenticated
  using (user_id = (select auth.uid()));

-- interview questions: approved questions are readable by signed-in users
create policy "interview_questions: read approved" on public.interview_questions for select to authenticated
  using (status = 'approved');

-- saved questions: manage your own
create policy "saved_questions: read own" on public.saved_questions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "saved_questions: create own" on public.saved_questions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "saved_questions: delete own" on public.saved_questions for delete to authenticated
  using (user_id = (select auth.uid()));

-- mentor profiles: anyone can see verified mentors; you can always see and edit your own
create policy "mentor_profiles: read verified" on public.mentor_profiles for select to anon, authenticated
  using (verification_status = 'verified');
create policy "mentor_profiles: read own" on public.mentor_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mentor_profiles: update own" on public.mentor_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- verifications: read your own application; the server writes
create policy "mentor_verifications: read own" on public.mentor_verifications for select to authenticated
  using (mentor_id = (select auth.uid()));

-- availability: mentors manage their own windows
create policy "mentor_availability: read own" on public.mentor_availability for select to authenticated
  using (mentor_id = (select auth.uid()));
create policy "mentor_availability: create own" on public.mentor_availability for insert to authenticated
  with check (mentor_id = (select auth.uid()));
create policy "mentor_availability: delete own" on public.mentor_availability for delete to authenticated
  using (mentor_id = (select auth.uid()));

-- bookings: both parties can read; changes only through the functions above
create policy "bookings: read as mentor or mentee" on public.bookings for select to authenticated
  using ((select auth.uid()) in (mentor_id, mentee_id));

-- reviews: public for verified mentors; written only through submit_mentor_review
create policy "mentor_reviews: read for verified mentors" on public.mentor_reviews for select to anon, authenticated
  using (exists (
    select 1 from public.mentor_profiles mp
    where mp.user_id = mentor_id and mp.verification_status = 'verified'
  ));

-- =====================================================================
-- Privileges: RLS decides which rows, grants decide which columns
-- =====================================================================
revoke all on public.goals, public.milestones, public.resumes, public.resume_analyses,
              public.interview_questions, public.saved_questions, public.practice_attempts,
              public.mentor_profiles, public.mentor_verifications, public.mentor_availability,
              public.bookings, public.mentor_reviews
  from anon, authenticated;

grant select, delete on public.goals, public.milestones to authenticated;
grant insert (user_id, title, description, category, target_date) on public.goals to authenticated;
grant update (title, description, category, target_date, status, completed_at) on public.goals to authenticated;
grant insert (goal_id, user_id, title, notes, target_date, position) on public.milestones to authenticated;
grant update (title, notes, target_date, position, completed_at) on public.milestones to authenticated;

grant select on public.resumes, public.resume_analyses, public.interview_questions to authenticated;
grant select, delete on public.practice_attempts to authenticated;
grant select, insert, delete on public.saved_questions to authenticated;

grant select on public.mentor_profiles, public.mentor_reviews to anon, authenticated;
grant update (headline, bio, job_title, company, years_experience, expertise, languages,
              session_minutes, is_accepting) on public.mentor_profiles to authenticated;
grant select on public.mentor_verifications, public.bookings to authenticated;
grant select, delete on public.mentor_availability to authenticated;
grant insert (mentor_id, weekday, start_time, end_time) on public.mentor_availability to authenticated;

revoke execute on function public.mentor_open_slots(uuid, integer, uuid) from public;
revoke execute on function public.request_booking(uuid, timestamptz, text) from public, anon;
revoke execute on function public.respond_to_booking(uuid, boolean, text, text) from public, anon;
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
revoke execute on function public.reschedule_booking(uuid, timestamptz) from public, anon;
revoke execute on function public.submit_mentor_review(uuid, smallint, text) from public, anon;

grant execute on function public.mentor_open_slots(uuid, integer, uuid) to anon, authenticated, service_role;
grant execute on function public.request_booking(uuid, timestamptz, text) to authenticated;
grant execute on function public.respond_to_booking(uuid, boolean, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
grant execute on function public.submit_mentor_review(uuid, smallint, text) to authenticated;

commit;
