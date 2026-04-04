-- ============================================================
-- AI경영학과 커뮤니티 — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (extends auth.users)
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text not null,
  flag       text not null default '🇰🇷',
  role       text not null default 'student', -- 'student' | 'professor'
  avatar_letter text not null default 'U',
  language   text not null default 'ko',
  created_at timestamptz default now()
);

-- 2. POSTS
create table if not exists posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade not null,
  title      text not null,
  body       text not null,
  category   text not null default 'free', -- free|qa|study|career|resource|event|notice
  language   text not null default 'ko',   -- ko|en|zh
  pinned     boolean default false,
  created_at timestamptz default now()
);

-- 3. LIKES
create table if not exists likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  unique(post_id, user_id)
);

-- 4. COMMENTS
create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references posts(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  body       text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table posts    enable row level security;
alter table likes    enable row level security;
alter table comments enable row level security;

-- profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- posts
create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on posts for update using (auth.uid() = user_id);
create policy "posts_delete" on posts for delete using (auth.uid() = user_id);

-- likes
create policy "likes_select" on likes for select using (true);
create policy "likes_insert" on likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on likes for delete using (auth.uid() = user_id);

-- comments
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on comments for delete using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, avatar_letter)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    upper(substr(coalesce(new.raw_user_meta_data->>'username', new.email), 1, 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- SEED DATA (optional — sample posts)
-- ============================================================
-- Run after creating your first user account and getting its UUID
-- INSERT INTO posts (user_id, title, body, category, language, pinned)
-- VALUES ('your-user-uuid', '2026년 1학기 AI경영 프로젝트 발표 일정', '4월 25일(금) 오후 2시...', 'notice', 'ko', true);
