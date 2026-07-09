create type public.gratitude_entry_kind as enum ('thank_you', 'noticed');
create type public.gratitude_reaction as enum ('none', 'seen', 'loved');

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Maia + Husband',
  delivery_time time not null default '21:00',
  timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now()
);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

create table public.gratitude_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind public.gratitude_entry_kind not null,
  body text not null check (char_length(body) between 1 and 220),
  local_entry_date date not null,
  deliver_at timestamptz not null,
  delivered_at timestamptz,
  recipient_reaction public.gratitude_reaction not null default 'none',
  recipient_seen_at timestamptz,
  recipient_loved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (couple_id, author_id, local_entry_date)
);

create table public.generated_reviews (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  review_type text not null check (review_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  check (
    review_type <> 'weekly'
    or (
      extract(isodow from period_start) = 1
      and extract(isodow from period_end) = 7
      and period_end = period_start + 6
    )
  ),
  title text not null,
  body text not null,
  highlights jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (couple_id, review_type, period_start, period_end)
);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.gratitude_entries enable row level security;
alter table public.generated_reviews enable row level security;

create or replace function public.prevent_gratitude_entry_content_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.couple_id <> old.couple_id
    or new.author_id <> old.author_id
    or new.recipient_id <> old.recipient_id
    or new.kind <> old.kind
    or new.body <> old.body
    or new.local_entry_date <> old.local_entry_date
    or new.deliver_at <> old.deliver_at
    or new.created_at <> old.created_at then
    raise exception 'Gratitude entries cannot be edited after sending.';
  end if;

  return new;
end;
$$;

create trigger gratitude_entries_prevent_content_changes
before update on public.gratitude_entries
for each row
execute function public.prevent_gratitude_entry_content_changes();

create or replace function public.prevent_gratitude_entry_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Gratitude entries cannot be deleted.';
end;
$$;

create trigger gratitude_entries_prevent_delete
before delete on public.gratitude_entries
for each row
execute function public.prevent_gratitude_entry_delete();

create policy "members can read their couples"
on public.couples for select
using (
  exists (
    select 1 from public.couple_members
    where couple_members.couple_id = couples.id
      and couple_members.user_id = auth.uid()
  )
);

create policy "members can read couple members"
on public.couple_members for select
using (
  exists (
    select 1 from public.couple_members viewer
    where viewer.couple_id = couple_members.couple_id
      and viewer.user_id = auth.uid()
  )
);

create policy "members can read entries"
on public.gratitude_entries for select
using (
  exists (
    select 1 from public.couple_members
    where couple_members.couple_id = gratitude_entries.couple_id
      and couple_members.user_id = auth.uid()
  )
);

create policy "members can write their daily entry"
on public.gratitude_entries for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.couple_members
    where couple_members.couple_id = gratitude_entries.couple_id
      and couple_members.user_id = auth.uid()
  )
);

create policy "recipients can mark entries seen or loved"
on public.gratitude_entries for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "members can read generated reviews"
on public.generated_reviews for select
using (
  exists (
    select 1 from public.couple_members
    where couple_members.couple_id = generated_reviews.couple_id
      and couple_members.user_id = auth.uid()
  )
);
