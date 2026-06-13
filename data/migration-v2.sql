-- Миграция v2: самостоятельное снятие брони гостем + RSVP «Я приду».
-- Идентификатор гостя — visitor_id (генерится в браузере, хранится скрыто).

-- ── Владелец брони (в закрытой таблице, публике не виден) ─────────
alter table public.booking_names add column if not exists owner_id text;

-- ── Бронь с владельцем ────────────────────────────────────────────
drop function if exists public.reserve_item(text, text);
create or replace function public.reserve_item(p_item_id text, p_name text, p_owner_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.bookings(item_id) values (p_item_id);
  insert into public.booking_names(item_id, name, owner_id) values (p_item_id, p_name, p_owner_id);
  return true;
exception when unique_violation then
  return false;
end; $$;
revoke all on function public.reserve_item(text, text, text) from public;
grant execute on function public.reserve_item(text, text, text) to anon, authenticated;

-- ── Снять СВОЮ бронь (только при совпадении owner_id) ──────────────
create or replace function public.cancel_own(p_item_id text, p_owner_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare deleted int;
begin
  delete from public.bookings b
   where b.item_id = p_item_id
     and exists (select 1 from public.booking_names n
                  where n.item_id = p_item_id and n.owner_id = p_owner_id);
  get diagnostics deleted = row_count;
  return deleted > 0;
end; $$;
revoke all on function public.cancel_own(text, text) from public;
grant execute on function public.cancel_own(text, text) to anon, authenticated;

-- ── Какие позиции забронировал данный гость (для показа кнопки) ────
create or replace function public.my_items(p_owner_id text)
returns setof text language sql security definer set search_path = public as $$
  select item_id from public.booking_names where owner_id = p_owner_id;
$$;
revoke all on function public.my_items(text) from public;
grant execute on function public.my_items(text) to anon, authenticated;

-- ── RSVP «Я приду» (имена скрыты от публики, видит только админ) ───
create table if not exists public.rsvps (
  visitor_id text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
alter table public.rsvps enable row level security;
drop policy if exists "admin read rsvps" on public.rsvps;
create policy "admin read rsvps" on public.rsvps for select using (auth.role() = 'authenticated');

create or replace function public.rsvp_set(p_visitor_id text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvps(visitor_id, name) values (p_visitor_id, p_name)
  on conflict (visitor_id) do update set name = excluded.name;
end; $$;
revoke all on function public.rsvp_set(text, text) from public;
grant execute on function public.rsvp_set(text, text) to anon, authenticated;

create or replace function public.rsvp_unset(p_visitor_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.rsvps where visitor_id = p_visitor_id;
$$;
revoke all on function public.rsvp_unset(text) from public;
grant execute on function public.rsvp_unset(text) to anon, authenticated;

create or replace function public.rsvp_get(p_visitor_id text)
returns text language sql security definer set search_path = public as $$
  select name from public.rsvps where visitor_id = p_visitor_id;
$$;
revoke all on function public.rsvp_get(text) from public;
grant execute on function public.rsvp_get(text) to anon, authenticated;
