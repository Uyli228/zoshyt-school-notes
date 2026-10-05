-- Статистика переглядів параграфів. Виконай увесь файл у Supabase → SQL Editor
-- (після schema.sql). Читачі лише додають +1 перегляд, бачити цифри може тільки адміністратор.

create table if not exists public.paragraph_view_days (
  paragraph_id text not null check (char_length(paragraph_id) between 1 and 100),
  day date not null default current_date,
  views bigint not null default 0,
  primary key (paragraph_id, day)
);

alter table public.paragraph_view_days enable row level security;
revoke all on table public.paragraph_view_days from anon, authenticated;
grant select on table public.paragraph_view_days to authenticated;

drop policy if exists "Admins can read view stats" on public.paragraph_view_days;
create policy "Admins can read view stats"
  on public.paragraph_view_days for select to authenticated
  using ((select public.is_library_admin()));

create or replace function public.record_paragraph_view(p_paragraph_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_paragraph_id is null or char_length(p_paragraph_id) not between 1 and 100 then
    return;
  end if;
  -- Рахуємо лише параграфи, які справді є в бібліотеці.
  if not exists (
    select 1
    from public.library_documents d,
         jsonb_array_elements(d.data) s,
         jsonb_array_elements(s -> 'topics') t,
         jsonb_array_elements(t -> 'paragraphs') p
    where d.id = 1 and p ->> 'id' = p_paragraph_id
  ) then
    return;
  end if;
  insert into public.paragraph_view_days (paragraph_id, day, views)
  values (p_paragraph_id, current_date, 1)
  on conflict (paragraph_id, day) do update set views = public.paragraph_view_days.views + 1;
end;
$body$;

revoke all on function public.record_paragraph_view(text) from public;
grant execute on function public.record_paragraph_view(text) to anon, authenticated;
