-- Схема для общей брони (выполнить в Supabase → SQL Editor → Run).

-- Таблица броней. item_id = PRIMARY KEY → одну позицию нельзя забронировать дважды.
create table if not exists public.bookings (
  item_id    text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Включаем Row Level Security.
alter table public.bookings enable row level security;

-- Политики для анонимных гостей (публичная страница-приглашение).
-- Все могут смотреть, бронировать и отменять бронь.
drop policy if exists "read bookings"   on public.bookings;
drop policy if exists "insert bookings" on public.bookings;
drop policy if exists "delete bookings" on public.bookings;

create policy "read bookings"   on public.bookings for select using (true);
create policy "insert bookings" on public.bookings for insert with check (true);
create policy "delete bookings" on public.bookings for delete using (true);

-- Включить Realtime для таблицы (обновление брони у всех в реальном времени):
-- Dashboard → Database → Replication → добавить таблицу bookings,
-- либо выполнить:
alter publication supabase_realtime add table public.bookings;

-- ─────────────────────────────────────────────────────────────────
-- Учёт посещений (для страницы администратора).
create table if not exists public.visits (
  id         uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.visits enable row level security;

drop policy if exists "insert visits" on public.visits;
drop policy if exists "read visits"   on public.visits;

create policy "insert visits" on public.visits for insert with check (true);
create policy "read visits"   on public.visits for select using (true);
