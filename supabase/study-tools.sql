-- Run once in Supabase Dashboard → SQL Editor to enable shared comments.
-- Quiz decks and flashcards remain private to each reader's browser.

create table if not exists public.library_comments (
  id uuid primary key default gen_random_uuid(),
  paragraph_id text not null check (char_length(btrim(paragraph_id)) between 1 and 120),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 2 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists library_comments_paragraph_created_idx
  on public.library_comments (paragraph_id, created_at desc);

alter table public.library_comments enable row level security;
revoke all on table public.library_comments from anon, authenticated;
grant select on table public.library_comments to anon, authenticated;
grant insert, delete on table public.library_comments to authenticated;

drop policy if exists "Anyone can read paragraph comments" on public.library_comments;
create policy "Anyone can read paragraph comments"
  on public.library_comments for select to anon, authenticated
  using (true);

drop policy if exists "Signed-in readers can add comments" on public.library_comments;
create policy "Signed-in readers can add comments"
  on public.library_comments for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors and admins can delete comments" on public.library_comments;
create policy "Authors and admins can delete comments"
  on public.library_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_library_admin()));

create or replace function public.enforce_library_comment_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  daily_count integer;
  metadata jsonb;
  email_address text;
begin
  new.author_id := (select auth.uid());
  if new.author_id is null then
    raise exception 'Sign in before commenting.' using errcode = '42501';
  end if;

  new.paragraph_id := btrim(new.paragraph_id);
  new.body := btrim(new.body);
  if char_length(new.paragraph_id) not between 1 and 120
     or char_length(new.body) not between 2 and 1200 then
    raise exception 'Comment length is invalid.' using errcode = '22023';
  end if;
  if (length(new.body) - length(replace(new.body, 'http', ''))) / 4 > 1 then
    raise exception 'Too many links in one comment.' using errcode = '22023';
  end if;

  select raw_user_meta_data, email into metadata, email_address
  from auth.users where id = new.author_id;
  new.author_name := left(coalesce(
    nullif(btrim(metadata->>'full_name'), ''),
    nullif(btrim(metadata->>'name'), ''),
    nullif(split_part(email_address, '@', 1), ''),
    'Учень'
  ), 80);
  new.created_at := now();

  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
  select count(*) into recent_count
  from public.library_comments
  where author_id = new.author_id and created_at > now() - interval '10 minutes';
  select count(*) into daily_count
  from public.library_comments
  where author_id = new.author_id and created_at > now() - interval '24 hours';

  if recent_count >= 4 or daily_count >= 15 then
    raise exception 'Comment rate limit reached.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.library_comments
    where author_id = new.author_id
      and paragraph_id = new.paragraph_id
      and lower(body) = lower(new.body)
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'Duplicate comment.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_library_comment_rules() from public, anon, authenticated;
drop trigger if exists enforce_library_comment_rules on public.library_comments;
create trigger enforce_library_comment_rules
  before insert on public.library_comments
  for each row execute function public.enforce_library_comment_rules();

do $$
begin
  alter publication supabase_realtime add table public.library_comments;
exception when duplicate_object then
  null;
end;
$$;
