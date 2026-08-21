-- =====================================================================
--  GAME HỌC — bảng games (admin mỗi giáo xứ tự quản lý danh sách)
--  Chạy 1 lần trong Supabase → SQL Editor.
-- =====================================================================
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  name        text not null,
  description text,
  url         text,                              -- link chơi (tên miền ngoài, vd WeCatholic)
  emoji       text default '🎮',
  color       text default '#3b82f6',
  min_plan    text not null default 'standard',  -- free | standard | pro (gói tối thiểu để mở khóa)
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.games enable row level security;

-- Đọc: mọi thành viên giáo xứ (để chơi). Ghi: chỉ admin.
drop policy if exists games_select on public.games;
create policy games_select on public.games for select
  using (parish_id = public.current_parish_id());
drop policy if exists games_admin on public.games;
create policy games_admin on public.games for all
  using (public.is_admin() and parish_id = public.current_parish_id())
  with check (public.is_admin() and parish_id = public.current_parish_id());

create index if not exists idx_games_parish on public.games(parish_id);
