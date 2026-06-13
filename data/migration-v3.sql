-- Миграция v3: RSVP с признаком «со второй половинкой» (+1).

alter table public.rsvps add column if not exists with_partner boolean not null default false;

-- rsvp_set теперь принимает признак второй половинки.
drop function if exists public.rsvp_set(text, text);
create or replace function public.rsvp_set(p_visitor_id text, p_name text, p_with_partner boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvps(visitor_id, name, with_partner)
  values (p_visitor_id, p_name, p_with_partner)
  on conflict (visitor_id) do update
    set name = excluded.name, with_partner = excluded.with_partner;
end; $$;
revoke all on function public.rsvp_set(text, text, boolean) from public;
grant execute on function public.rsvp_set(text, text, boolean) to anon, authenticated;

-- rsvp_get возвращает имя + признак (json) либо null.
drop function if exists public.rsvp_get(text);
create or replace function public.rsvp_get(p_visitor_id text)
returns json language sql security definer set search_path = public as $$
  select row_to_json(t)
  from (select name, with_partner from public.rsvps where visitor_id = p_visitor_id) t;
$$;
revoke all on function public.rsvp_get(text) from public;
grant execute on function public.rsvp_get(text) to anon, authenticated;
