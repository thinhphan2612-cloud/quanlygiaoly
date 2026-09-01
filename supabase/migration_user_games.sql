-- =============================================================
--  Kho game theo TỪNG USER (thêm từ Ephata Store)
--  Store bấm "+ Thêm vào Giáo Lý Số" -> webhook -> Edge Function
--  'provision' ghi vào bảng này (service_role). User đọc game của
--  chính mình và chơi nhúng iframe play_url trong app.
-- =============================================================
create table if not exists public.user_games (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,                 -- slug game (duy nhất theo user)
  title      text not null,
  play_url   text not null,                 -- game host trên store
  icon       text default '◈',
  source     text not null default 'ephata',
  created_at timestamptz default now(),
  unique (user_id, key)
);
create index if not exists idx_user_games_user on public.user_games(user_id);

alter table public.user_games enable row level security;

-- User chỉ đọc / xoá game của chính mình. Ghi (insert/update) do Edge
-- Function 'provision' làm bằng service_role (bỏ qua RLS).
drop policy if exists ug_select on public.user_games;
create policy ug_select on public.user_games for select using (user_id = auth.uid());

drop policy if exists ug_delete on public.user_games;
create policy ug_delete on public.user_games for delete using (user_id = auth.uid());
