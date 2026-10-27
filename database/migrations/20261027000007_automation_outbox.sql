-- =====================================================================
-- Phase 6 · Automation outbox (events for n8n)
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
--
-- The "transactional outbox" pattern
--   Triggers write an event row in the SAME transaction as the change that
--   caused it (a booking confirmed, a plan bought). So an event exists if and
--   only if the change was saved: none are lost if the server crashes, and none
--   are sent for a change that was rolled back. The server's dispatcher then
--   delivers pending rows to n8n, signed, and retries with backoff.
--
-- Delivery is "at least once": a row may be sent twice (say the server stops
-- after n8n received it but before it was marked sent). Each event carries a
-- dedupe key so the receiver can ignore repeats.
--
-- Personal data is kept to a minimum: ids, first names, times and plan names.
-- No email addresses, journal text, booking topics or payment details.
--
-- Security: server only. RLS is on with no policies, and nobody but the
-- service role can read the table or call the functions.
-- =====================================================================

begin;

create table public.outbox_events (
  id               bigint generated always as identity primary key,
  event_type       text not null check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  -- Same key = same event. The receiver uses it to ignore repeat deliveries.
  dedupe_key       text not null unique check (char_length(dedupe_key) between 1 and 200),
  payload          jsonb not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts         integer not null default 0 check (attempts >= 0),
  next_attempt_at  timestamptz not null default now(),
  -- While 'sending': if the server dies, the row becomes claimable again after this.
  locked_until     timestamptz,
  last_error       text check (char_length(last_error) <= 500),
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create index outbox_events_due_idx on public.outbox_events (next_attempt_at)
  where status in ('pending', 'sending');
create index outbox_events_created_idx on public.outbox_events (created_at desc);

-- ---------------------------------------------------------------------
-- Writing events
-- ---------------------------------------------------------------------
create or replace function public.enqueue_event(p_type text, p_dedupe_key text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.outbox_events (event_type, dedupe_key, payload)
  values (p_type, p_dedupe_key, p_payload)
  on conflict (dedupe_key) do nothing;
$$;

create or replace function public.first_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(full_name, ' ', 1) from public.profiles where id = p_user;
$$;

-- A new account: welcome email.
create or replace function public.outbox_on_profile_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_event('user.welcome', 'user.welcome:' || new.id,
    jsonb_build_object('userId', new.id, 'firstName', split_part(new.full_name, ' ', 1)));
  return new;
end;
$$;

create trigger profiles_outbox
  after insert on public.profiles
  for each row execute function public.outbox_on_profile_created();

-- Bookings: requested, confirmed, declined, cancelled, rescheduled.
create or replace function public.outbox_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    v_type := 'booking.requested';
  elsif new.starts_at is distinct from old.starts_at then
    v_type := 'booking.rescheduled';
  elsif new.status is distinct from old.status and new.status in ('confirmed', 'declined', 'cancelled') then
    v_type := 'booking.' || new.status;
  else
    return new;
  end if;

  -- The start time is part of the key: a session moved and confirmed again is a new event.
  perform public.enqueue_event(v_type,
    v_type || ':' || new.id || ':' || extract(epoch from new.starts_at)::bigint,
    jsonb_build_object(
      'bookingId', new.id,
      'startsAt', new.starts_at,
      'endsAt', new.ends_at,
      'mentorFirstName', public.first_name(new.mentor_id),
      'menteeFirstName', public.first_name(new.mentee_id),
      'menteeTimezone', (select timezone from public.profiles where id = new.mentee_id)
    ));
  return new;
end;
$$;

create trigger bookings_outbox
  after insert or update of status, starts_at on public.bookings
  for each row execute function public.outbox_on_booking_change();

-- A paid plan period: payment receipt.
create or replace function public.outbox_on_plan_purchased()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_event('payment.succeeded', 'payment.succeeded:' || new.order_id,
    jsonb_build_object(
      'userId', new.user_id,
      'orderId', new.order_id,
      'plan', new.plan,
      'amountPaise', (select amount_paise from public.billing_orders where id = new.order_id),
      'periodStart', new.starts_at,
      'periodEnd', new.ends_at,
      'firstName', public.first_name(new.user_id),
      'demo', true
    ));
  return new;
end;
$$;

create trigger plan_subscriptions_outbox
  after insert on public.plan_subscriptions
  for each row execute function public.outbox_on_plan_purchased();

-- A mentor application waiting for review: admin alert.
create or replace function public.outbox_on_mentor_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_event('admin.mentor_application', 'admin.mentor_application:' || new.user_id,
    jsonb_build_object('mentorUserId', new.user_id, 'firstName', public.first_name(new.user_id)));
  return new;
end;
$$;

create trigger mentor_profiles_outbox
  after insert on public.mentor_profiles
  for each row execute function public.outbox_on_mentor_application();

-- Reminders for confirmed sessions starting within the next hour. The dispatcher
-- calls this on every round; the dedupe key makes repeated calls harmless, and a
-- session cancelled or moved beforehand is no longer 'confirmed' at that time, so
-- it gets no reminder (or gets one for its new time).
create or replace function public.enqueue_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.outbox_events (event_type, dedupe_key, payload)
  select 'booking.reminder',
         'booking.reminder:' || b.id || ':' || extract(epoch from b.starts_at)::bigint,
         jsonb_build_object(
           'bookingId', b.id,
           'startsAt', b.starts_at,
           'endsAt', b.ends_at,
           'mentorFirstName', public.first_name(b.mentor_id),
           'menteeFirstName', public.first_name(b.mentee_id),
           'menteeTimezone', (select timezone from public.profiles where id = b.mentee_id)
         )
  from public.bookings b
  where b.status = 'confirmed'
    and b.starts_at > now()
    and b.starts_at <= now() + interval '1 hour'
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Delivering events (server only)
-- ---------------------------------------------------------------------

-- Take up to p_limit due events and lease them for p_lease_seconds. SKIP LOCKED
-- lets several server instances share the work without sending a row twice at once.
create or replace function public.claim_outbox_events(p_limit integer, p_lease_seconds integer)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  update public.outbox_events e
  set status = 'sending',
      attempts = e.attempts + 1,
      locked_until = now() + make_interval(secs => p_lease_seconds)
  where e.id in (
    select id from public.outbox_events
    where (status = 'pending' and next_attempt_at <= now())
       or (status = 'sending' and locked_until < now())
    order by id
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  returning e.*;
$$;

-- Record the outcome of one delivery. Failures wait 30 s, 1 min, 2 min, … (at most
-- an hour) before the next try; after p_max_attempts the event is parked as 'failed'
-- until an admin retries it.
create or replace function public.finish_outbox_event(
  p_id bigint,
  p_ok boolean,
  p_error text default null,
  p_max_attempts integer default 8
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outbox_events
  set status = case when p_ok then 'sent'
                    when attempts >= p_max_attempts then 'failed'
                    else 'pending' end,
      sent_at = case when p_ok then now() end,
      last_error = case when p_ok then null else left(p_error, 500) end,
      next_attempt_at = case when p_ok then next_attempt_at
                             else now() + least(interval '30 seconds' * power(2, attempts - 1), interval '1 hour') end,
      locked_until = null
  where id = p_id and status = 'sending';
$$;

-- =====================================================================
-- Row Level Security and privileges: server only
-- =====================================================================
alter table public.outbox_events enable row level security;
revoke all on public.outbox_events from anon, authenticated;

revoke execute on function public.enqueue_event(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.first_name(uuid) from public, anon, authenticated;
revoke execute on function public.enqueue_due_reminders() from public, anon, authenticated;
revoke execute on function public.claim_outbox_events(integer, integer) from public, anon, authenticated;
revoke execute on function public.finish_outbox_event(bigint, boolean, text, integer) from public, anon, authenticated;
revoke execute on function public.outbox_on_profile_created() from public, anon, authenticated;
revoke execute on function public.outbox_on_booking_change() from public, anon, authenticated;
revoke execute on function public.outbox_on_plan_purchased() from public, anon, authenticated;
revoke execute on function public.outbox_on_mentor_application() from public, anon, authenticated;
grant execute on function public.enqueue_due_reminders() to service_role;
grant execute on function public.claim_outbox_events(integer, integer) to service_role;
grant execute on function public.finish_outbox_event(bigint, boolean, text, integer) to service_role;

commit;
