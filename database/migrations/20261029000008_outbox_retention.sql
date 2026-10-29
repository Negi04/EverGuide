-- =====================================================================
-- Phase 6 · Outbox data retention
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
--
-- Outbox events hold first names and ids. They must not outlive the data
-- they describe, so:
--   * deleting an account, or a booking, deletes the events that mention it
--     (an account deletion removes its bookings first, through on delete
--     cascade, so their events go too);
--   * delivered events are kept 30 days for troubleshooting, failed ones 90,
--     then purge_outbox_events() deletes them. The dispatcher calls it hourly.
-- =====================================================================

begin;

create index outbox_events_user_idx on public.outbox_events ((payload ->> 'userId'));
create index outbox_events_booking_idx on public.outbox_events ((payload ->> 'bookingId'));

create or replace function public.outbox_forget_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.outbox_events where payload ->> 'bookingId' = old.id::text;
  return old;
end;
$$;

create trigger bookings_outbox_forget
  after delete on public.bookings
  for each row execute function public.outbox_forget_booking();

create or replace function public.outbox_forget_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.outbox_events
  where payload ->> 'userId' = old.id::text
     or payload ->> 'mentorUserId' = old.id::text;
  return old;
end;
$$;

create trigger profiles_outbox_forget
  after delete on public.profiles
  for each row execute function public.outbox_forget_profile();

-- Delete events past their retention period. Returns how many were deleted.
create or replace function public.purge_outbox_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.outbox_events
  where (status = 'sent' and sent_at < now() - interval '30 days')
     or (status = 'failed' and created_at < now() - interval '90 days');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.outbox_forget_booking() from public, anon, authenticated;
revoke execute on function public.outbox_forget_profile() from public, anon, authenticated;
revoke execute on function public.purge_outbox_events() from public, anon, authenticated;
grant execute on function public.purge_outbox_events() to service_role;

commit;
