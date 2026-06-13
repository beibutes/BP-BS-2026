-- Миграция v4: RSVP со статусом «придёт / не придёт».

alter table public.rsvps add column if not exists coming boolean not null default true;

-- rsvp_set теперь принимает статус участия.
drop function if exists public.rsvp_set(text, text, boolean);
create or replace function public.rsvp_set(p_visitor_id text, p_name text, p_with_partner boolean, p_coming boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvps(visitor_id, name, with_partner, coming)
  values (p_visitor_id, p_name, p_with_partner, p_coming)
  on conflict (visitor_id) do update
    set name = excluded.name, with_partner = excluded.with_partner, coming = excluded.coming;
end; $$;
revoke all on function public.rsvp_set(text, text, boolean, boolean) from public;
grant execute on function public.rsvp_set(text, text, boolean, boolean) to anon, authenticated;

-- rsvp_get возвращает имя + признаки.
drop function if exists public.rsvp_get(text);
create or replace function public.rsvp_get(p_visitor_id text)
returns json language sql security definer set search_path = public as $$
  select row_to_json(t)
  from (select name, with_partner, coming from public.rsvps where visitor_id = p_visitor_id) t;
$$;
revoke all on function public.rsvp_get(text) from public;
grant execute on function public.rsvp_get(text) to anon, authenticated;
