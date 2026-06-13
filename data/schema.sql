-- Итоговая схема БД (Supabase) для сайта-приглашения.
-- Модель безопасности: публике виден только факт брони (item_id).
-- Имена дарителей и журнал визитов закрыты — их читает только
-- аутентифицированный администратор (Supabase Auth).
-- Выполнять в Supabase → SQL Editor.

-- ── 1) Факт брони (публичная таблица, realtime) ───────────────────
create table if not exists public.bookings (
  item_id    text primary key,
  created_at timestamptz not null default now()
);
alter table public.bookings enable row level security;

drop policy if exists "read bookings"        on public.bookings;
drop policy if exists "admin delete bookings" on public.bookings;
-- список занятых позиций виден всем (для главной страницы + realtime)
create policy "read bookings" on public.bookings for select using (true);
-- снимать бронь может только админ
create policy "admin delete bookings" on public.bookings
  for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.bookings;

-- ── 2) Имена дарителей (скрыты от публики) ────────────────────────
create table if not exists public.booking_names (
  item_id    text primary key references public.bookings(item_id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.booking_names enable row level security;
drop policy if exists "admin read booking_names" on public.booking_names;
create policy "admin read booking_names" on public.booking_names
  for select using (auth.role() = 'authenticated');

-- ── 3) Журнал визитов (писать — все, читать — только админ) ────────
create table if not exists public.visits (
  id         uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.visits enable row level security;
drop policy if exists "public insert visits" on public.visits;
drop policy if exists "admin read visits"    on public.visits;
create policy "public insert visits" on public.visits for insert with check (true);
create policy "admin read visits"    on public.visits for select using (auth.role() = 'authenticated');

-- ── 4) Атомарная бронь: факт + имя одним вызовом ──────────────────
create or replace function public.reserve_item(p_item_id text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bookings(item_id) values (p_item_id);
  insert into public.booking_names(item_id, name) values (p_item_id, p_name);
  return true;
exception when unique_violation then
  return false; -- позиция уже занята
end;
$$;
revoke all on function public.reserve_item(text, text) from public;
grant execute on function public.reserve_item(text, text) to anon, authenticated;
