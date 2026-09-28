-- Run once in Supabase SQL Editor to enable moderated student submissions.
create table if not exists public.library_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  subject_name text not null check (char_length(btrim(subject_name)) between 1 and 60),
  topic_name text not null check (char_length(btrim(topic_name)) between 1 and 90),
  title text not null check (char_length(btrim(title)) between 1 and 110),
  summary text not null default '' check (char_length(summary) <= 180),
  content text not null check (char_length(btrim(content)) between 20 and 10000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz
);

alter table public.library_submissions enable row level security;
alter table public.library_submissions
  add column if not exists image_data text not null default ''
  check (char_length(image_data) <= 500000 and (image_data = '' or image_data like 'data:image/jpeg;base64,%')),
  add column if not exists quiz_data jsonb
  check (quiz_data is null or (jsonb_typeof(quiz_data) = 'object' and octet_length(quiz_data::text) <= 30000)),
  add column if not exists flashcards_data jsonb
  check (flashcards_data is null or (jsonb_typeof(flashcards_data) = 'object' and octet_length(flashcards_data::text) <= 30000)),
  add column if not exists published_paragraph_id text
  check (published_paragraph_id is null or char_length(btrim(published_paragraph_id)) between 1 and 120);

-- Link already-approved submissions to their published paragraph when the match is unambiguous.
with matches as (
  select
    submission.id as submission_id,
    paragraphs.value->>'id' as paragraph_id,
    count(*) over (partition by submission.id) as match_count,
    row_number() over (partition by submission.id order by paragraphs.value->>'id') as match_number
  from public.library_submissions as submission
  cross join public.library_documents as library
  cross join lateral jsonb_array_elements(library.data) as subjects(value)
  cross join lateral jsonb_array_elements(coalesce(subjects.value->'topics', '[]'::jsonb)) as topics(value)
  cross join lateral jsonb_array_elements(coalesce(topics.value->'paragraphs', '[]'::jsonb)) as paragraphs(value)
  where library.id = 1
    and submission.status = 'approved'
    and submission.published_paragraph_id is null
    and lower(btrim(subjects.value->>'name')) = lower(btrim(submission.subject_name))
    and lower(btrim(topics.value->>'name')) = lower(btrim(submission.topic_name))
    and lower(btrim(paragraphs.value->>'name')) = lower(btrim(submission.title))
    and btrim(paragraphs.value->>'content') = btrim(submission.content)
)
update public.library_submissions as submission
set published_paragraph_id = matches.paragraph_id
from matches
where matches.submission_id = submission.id
  and matches.match_count = 1
  and matches.match_number = 1;
revoke all on table public.library_submissions from anon, authenticated;
grant select, insert on table public.library_submissions to authenticated;

drop policy if exists "Authors and admins can read submissions" on public.library_submissions;
create policy "Authors and admins can read submissions"
  on public.library_submissions for select to authenticated
  using (author_id = (select auth.uid()) or (select public.is_library_admin()));

drop policy if exists "Signed-in users can submit for review" on public.library_submissions;
create policy "Signed-in users can submit for review"
  on public.library_submissions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
  );

create or replace function public.enforce_library_submission_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  new.author_id := (select auth.uid());
  new.status := 'pending';
  new.reviewer_id := null;
  new.reviewed_at := null;
  new.created_at := now();
  new.published_paragraph_id := null;

  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
  select count(*) into recent_count
  from public.library_submissions
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Too many submissions. Try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_library_submission_rate on public.library_submissions;
create trigger enforce_library_submission_rate
  before insert on public.library_submissions
  for each row execute function public.enforce_library_submission_rate();

create or replace function public.review_library_submission(p_submission_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission public.library_submissions%rowtype;
  library_data jsonb;
  library_revision bigint;
  subject_data jsonb;
  topics_data jsonb;
  topic_data jsonb;
  paragraph_data jsonb;
  subject_index integer;
  topic_index integer;
  subject_id text;
  topic_id text;
  reviewed_status text;
  created_paragraph_id text;
  reviewed_time timestamptz := now();
begin
  if not (select public.is_library_admin()) then
    raise exception 'Only library admins can review submissions.' using errcode = '42501';
  end if;

  select * into submission
  from public.library_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed.' using errcode = 'P0001';
  end if;

  reviewed_status := case when p_approve then 'approved' else 'rejected' end;

  if p_approve then
    select data, revision into library_data, library_revision
    from public.library_documents where id = 1 for update;
    if not found then
      raise exception 'Shared library row is missing.' using errcode = 'P0002';
    end if;

    select (ordinality - 1)::integer, value->>'id'
      into subject_index, subject_id
    from jsonb_array_elements(library_data) with ordinality as subjects(value, ordinality)
    where lower(btrim(value->>'name')) = lower(btrim(submission.subject_name))
    limit 1;

    if subject_index is null then
      subject_index := jsonb_array_length(library_data);
      subject_id := gen_random_uuid()::text;
      subject_data := jsonb_build_object(
        'id', subject_id, 'name', btrim(submission.subject_name), 'icon', '📚',
        'color', '#7969dd', 'tint', '#f0edff', 'topics', '[]'::jsonb
      );
      library_data := library_data || jsonb_build_array(subject_data);
    else
      subject_data := library_data->subject_index;
    end if;

    topics_data := coalesce(subject_data->'topics', '[]'::jsonb);
    select (ordinality - 1)::integer, value->>'id'
      into topic_index, topic_id
    from jsonb_array_elements(topics_data) with ordinality as topics(value, ordinality)
    where lower(btrim(value->>'name')) = lower(btrim(submission.topic_name))
    limit 1;

    created_paragraph_id := gen_random_uuid()::text;
    paragraph_data := jsonb_build_object(
      'id', created_paragraph_id,
      'ownerId', submission.author_id,
      'createdAt', reviewed_time,
      'name', btrim(submission.title),
      'summary', btrim(submission.summary),
      'content', btrim(submission.content),
      'image', coalesce(nullif(submission.image_data, ''), ''),
      'tags', '[]'::jsonb,
      'updatedAt', reviewed_time,
      'history', '[]'::jsonb
    );
    if submission.quiz_data is not null then
      paragraph_data := jsonb_set(paragraph_data, '{quiz}', submission.quiz_data, true);
    end if;
    if submission.flashcards_data is not null then
      paragraph_data := jsonb_set(paragraph_data, '{flashcards}', submission.flashcards_data, true);
    end if;

    if topic_index is null then
      topic_index := jsonb_array_length(topics_data);
      topic_id := gen_random_uuid()::text;
      topic_data := jsonb_build_object(
        'id', topic_id, 'name', btrim(submission.topic_name),
        'description', '', 'paragraphs', jsonb_build_array(paragraph_data)
      );
      topics_data := topics_data || jsonb_build_array(topic_data);
    else
      topic_data := topics_data->topic_index;
      topic_data := jsonb_set(
        topic_data,
        '{paragraphs}',
        coalesce(topic_data->'paragraphs', '[]'::jsonb) || jsonb_build_array(paragraph_data),
        true
      );
      topics_data := jsonb_set(topics_data, array[topic_index::text], topic_data, true);
    end if;

    subject_data := jsonb_set(subject_data, '{topics}', topics_data, true);
    library_data := jsonb_set(library_data, array[subject_index::text], subject_data, true);

    update public.library_documents
    set data = library_data, revision = library_revision + 1, updated_at = reviewed_time
    where id = 1;
  end if;

  update public.library_submissions
  set status = reviewed_status,
      reviewer_id = (select auth.uid()),
      reviewed_at = reviewed_time,
      published_paragraph_id = case when p_approve then created_paragraph_id else null end
  where id = p_submission_id;

  return jsonb_build_object('id', p_submission_id, 'status', reviewed_status);
end;
$$;

revoke all on function public.enforce_library_submission_rate() from public, anon, authenticated;
revoke all on function public.review_library_submission(uuid, boolean) from public, anon;
grant execute on function public.review_library_submission(uuid, boolean) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.library_submissions;
exception when duplicate_object then null;
end;
$$;

-- Учні можуть повідомляти про помилки; переглядати й закривати звіти можуть лише адміністратори.
create table if not exists public.library_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  subject_name text not null check (char_length(btrim(subject_name)) between 1 and 60),
  topic_name text not null check (char_length(btrim(topic_name)) between 1 and 90),
  paragraph_id text not null,
  paragraph_title text not null check (char_length(btrim(paragraph_title)) between 1 and 110),
  message text not null check (char_length(btrim(message)) between 5 and 1500),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz
);

alter table public.library_reports enable row level security;
revoke all on table public.library_reports from anon, authenticated;
grant select, insert, update on table public.library_reports to authenticated;

drop policy if exists "Admins can read library reports" on public.library_reports;
create policy "Admins can read library reports"
  on public.library_reports for select to authenticated
  using ((select public.is_library_admin()));

drop policy if exists "Signed-in users can report library errors" on public.library_reports;
create policy "Signed-in users can report library errors"
  on public.library_reports for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and reviewed_at is null);

drop policy if exists "Admins can resolve library reports" on public.library_reports;
create policy "Admins can resolve library reports"
  on public.library_reports for update to authenticated
  using ((select public.is_library_admin()))
  with check ((select public.is_library_admin()));

create or replace function public.enforce_library_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  new.author_id := (select auth.uid());
  new.status := 'pending';
  new.reviewer_id := null;
  new.reviewed_at := null;
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
  select count(*) into recent_count
  from public.library_reports
  where author_id = new.author_id and created_at > now() - interval '1 hour';
  if recent_count >= 10 then
    raise exception 'Too many reports. Try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_library_report_rate() from public, anon, authenticated;
drop trigger if exists enforce_library_report_rate on public.library_reports;
create trigger enforce_library_report_rate
  before insert on public.library_reports
  for each row execute function public.enforce_library_report_rate();
