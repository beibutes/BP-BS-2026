-- Миграция v5: имя второй половинки (partner_name) для RSVP «приду со второй половинкой».

alter table public.rsvps add column if not exists partner_name text;

-- rsvp_set теперь принимает имя второй половинки.
drop function if exists public.rsvp_set(text, text, boolean, boolean);
drop function if exists public.rsvp_set(text, text, boolean, boolean, text);
create or replace function public.rsvp_set(
  p_visitor_id text,
  p_name text,
  p_with_partner boolean,
  p_coming boolean,
  p_partner_name text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.rsvps(visitor_id, name, with_partner, coming, partner_name)
  values (
    p_visitor_id,
    p_name,
    p_with_partner,
    p_coming,
    case when p_with_partner then nullif(btrim(coalesce(p_partner_name, '')), '') else null end
  )
  on conflict (visitor_id) do update
    set name = excluded.name,
        with_partner = excluded.with_partner,
        coming = excluded.coming,
        partner_name = excluded.partner_name;
end; $$;
revoke all on function public.rsvp_set(text, text, boolean, boolean, text) from public;
grant execute on function public.rsvp_set(text, text, boolean, boolean, text) to anon, authenticated;

-- rsvp_get возвращает имя + признаки + имя второй половинки.
drop function if exists public.rsvp_get(text);
create or replace function public.rsvp_get(p_visitor_id text)
returns json language sql security definer set search_path = public as $$
  select row_to_json(t)
  from (
    select name, with_partner, coming, partner_name
    from public.rsvps where visitor_id = p_visitor_id
  ) t;
$$;
revoke all on function public.rsvp_get(text) from public;
grant execute on function public.rsvp_get(text) to anon, authenticated;
