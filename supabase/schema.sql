-- Виконай увесь файл у Supabase Dashboard → SQL Editor.
-- До браузера можна додавати лише publishable/anon key, ніколи service_role key.

create table if not exists public.library_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.library_admins enable row level security;
revoke all on table public.library_admins from anon, authenticated;
grant select on table public.library_admins to authenticated;

drop policy if exists "Admins can read their own role" on public.library_admins;
create policy "Admins can read their own role"
  on public.library_admins for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_library_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.library_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_library_admin() from public, anon;
grant execute on function public.is_library_admin() to authenticated;

create table if not exists public.library_documents (
  id smallint primary key check (id = 1),
  data jsonb not null default '[]'::jsonb check (jsonb_typeof(data) = 'array'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.library_documents (id, data, revision)
values (1, '[]'::jsonb, 0)
on conflict (id) do nothing;

alter table public.library_documents enable row level security;
revoke all on table public.library_documents from anon, authenticated;
grant select on table public.library_documents to anon, authenticated;
grant update on table public.library_documents to authenticated;

drop policy if exists "Anyone can read the shared library" on public.library_documents;
create policy "Anyone can read the shared library"
  on public.library_documents for select to anon, authenticated
  using (id = 1);

drop policy if exists "Only admins can update the shared library" on public.library_documents;
create policy "Only admins can update the shared library"
  on public.library_documents for update to authenticated
  using (id = 1 and (select public.is_library_admin()))
  with check (id = 1 and (select public.is_library_admin()));

-- Увімкни події таблиці для спільного оновлення відкритих сторінок.
do $$
begin
  alter publication supabase_realtime add table public.library_documents;
exception when duplicate_object then
  null;
end;
$$;

-- Після входу першого адміністратора через сайт знайди його UUID у
-- Authentication → Users і виконай (підстав свій UUID):
-- insert into public.library_admins (user_id) values ('00000000-0000-0000-0000-000000000000');
