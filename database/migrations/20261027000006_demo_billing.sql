-- =====================================================================
-- Phase 6 · Demo billing with Razorpay Test Mode
--
-- EverGuide is a college project: payments run in Razorpay Test Mode, so no
-- real money ever moves. The design is still the production one, so the same
-- tables work with live keys later.
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
--
-- How a purchase works
--   1. The server creates a Razorpay order and records it in billing_orders.
--      The price comes from the server, never from the browser.
--   2. After checkout, the server checks Razorpay's signature and calls
--      confirm_plan_payment(). Razorpay's webhook may report the same payment
--      again; apply_payment_event() records each event once and confirms the
--      order through the same function.
--   3. confirm_plan_payment() locks the order, so the browser callback and the
--      webhook arriving together still create exactly one month of access.
--
-- Security model
--   * Users can read their own orders and plan periods. Nobody but the server
--     (service role) can create or change them: a user can't grant themselves
--     a plan.
--   * payment_events is server-only and stores ids, not card or contact details.
--
-- Money is stored as integer paise (1 rupee = 100 paise).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Orders: one per checkout attempt
-- ---------------------------------------------------------------------
create table public.billing_orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  plan                 text not null check (plan in ('pro', 'premium')),
  -- What the server charged, fixed when the order was created.
  amount_paise         integer not null check (amount_paise > 0),
  currency             text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id    text not null unique check (razorpay_order_id ~ '^order_[A-Za-z0-9]+$'),
  razorpay_payment_id  text unique check (razorpay_payment_id ~ '^pay_[A-Za-z0-9]+$'),
  status               text not null default 'created' check (status in ('created', 'paid')),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  -- A paid order always names its payment and time; an unpaid one has neither.
  constraint billing_orders_paid_has_payment
    check ((status = 'paid') = (razorpay_payment_id is not null and paid_at is not null))
);

create index billing_orders_user_idx on public.billing_orders (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Plan periods: each paid order gives one month of its plan
-- ---------------------------------------------------------------------
create table public.plan_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  plan        text not null check (plan in ('pro', 'premium')),
  -- One order can never give two periods.
  order_id    uuid not null unique references public.billing_orders (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index plan_subscriptions_user_idx on public.plan_subscriptions (user_id, ends_at desc);

-- ---------------------------------------------------------------------
-- Webhook events: Razorpay's event id makes repeats harmless
-- ---------------------------------------------------------------------
create table public.payment_events (
  event_id           text primary key check (char_length(event_id) between 1 and 100),
  event_type         text not null check (char_length(event_type) between 1 and 100),
  razorpay_order_id  text,
  received_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Confirm a payment (server only, after it has checked Razorpay's signature)
-- ---------------------------------------------------------------------
-- Idempotent: confirming the same payment again returns the period it already
-- created. A second month of the same plan starts when the current one ends;
-- a different plan starts straight away (the higher plan applies while both run).
create or replace function public.confirm_plan_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise integer default null
)
returns public.plan_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders;
  v_period public.plan_subscriptions;
  v_start timestamptz;
begin
  -- The row lock makes the browser callback and the webhook take turns.
  select * into v_order from public.billing_orders
  where razorpay_order_id = p_razorpay_order_id
  for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    if v_order.razorpay_payment_id is distinct from p_razorpay_payment_id then
      raise exception 'This order was already paid by another payment.' using errcode = 'P0001';
    end if;
    select * into v_period from public.plan_subscriptions where order_id = v_order.id;
    return v_period;
  end if;

  if p_amount_paise is not null and p_amount_paise <> v_order.amount_paise then
    raise exception 'The payment amount doesn''t match the order.' using errcode = 'P0001';
  end if;

  -- Two different orders of one user paid at the same moment must both stack.
  perform pg_advisory_xact_lock(hashtext('everguide:plan:' || v_order.user_id::text));
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.plan_subscriptions
  where user_id = v_order.user_id and plan = v_order.plan;

  update public.billing_orders
  set status = 'paid', razorpay_payment_id = p_razorpay_payment_id, paid_at = now()
  where id = v_order.id;

  insert into public.plan_subscriptions (user_id, plan, order_id, starts_at, ends_at)
  values (v_order.user_id, v_order.plan, v_order.id, v_start, v_start + interval '1 month')
  returning * into v_period;
  return v_period;
end;
$$;

-- Record a webhook event once and act on it. Returns false for an event already
-- seen. Recording and confirming share one transaction: if confirming fails,
-- the event isn't recorded either, so Razorpay's retry gets another chance.
create or replace function public.apply_payment_event(
  p_event_id text,
  p_event_type text,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_events (event_id, event_type, razorpay_order_id)
  values (p_event_id, p_event_type, p_razorpay_order_id)
  on conflict (event_id) do nothing;
  if not found then
    return false;
  end if;

  if p_event_type in ('payment.captured', 'order.paid')
     and p_razorpay_order_id is not null and p_razorpay_payment_id is not null then
    perform public.confirm_plan_payment(p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise);
  end if;
  return true;
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.billing_orders      enable row level security;
alter table public.plan_subscriptions  enable row level security;
alter table public.payment_events      enable row level security;

create policy "billing_orders: read own" on public.billing_orders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "plan_subscriptions: read own" on public.plan_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- payment_events has no policies: only the server reads or writes it.

-- =====================================================================
-- Privileges: users may only read their own billing history
-- =====================================================================
revoke all on public.billing_orders, public.plan_subscriptions, public.payment_events
  from anon, authenticated;
grant select on public.billing_orders, public.plan_subscriptions to authenticated;

revoke execute on function public.confirm_plan_payment(text, text, integer) from public, anon, authenticated;
revoke execute on function public.apply_payment_event(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.confirm_plan_payment(text, text, integer) to service_role;
grant execute on function public.apply_payment_event(text, text, text, text, integer) to service_role;

commit;
