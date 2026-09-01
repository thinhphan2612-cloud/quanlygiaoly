-- =============================================================
--  GAME MẶC ĐỊNH cho toàn dự án (mọi tài khoản đều có).
--  - Game bundle sẵn trong repo (client/public/games/...) -> play_url tương đối.
--  - Game super-admin tải zip lên -> lưu Supabase Storage bucket 'default-games',
--    play_url = public URL của index.html.
-- =============================================================

-- Nhận diện super-admin theo email trong JWT (khớp client lib/superadmin).
create or replace function public.is_superadmin() returns boolean
  language sql stable as $$
  select coalesce(lower(auth.jwt()->>'email') in ('support.giaolyso@gmail.com'), false)
$$;

create table if not exists public.default_games (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,          -- slug
  title      text not null,
  icon       text default '🎮',
  play_url   text not null,                 -- URL tương đối (bundle) hoặc public URL (storage)
  source     text not null default 'builtin', -- builtin | upload
  order_index int default 0,
  created_at timestamptz default now()
);
alter table public.default_games enable row level security;

-- Đọc: tất cả (kể cả chưa đăng nhập vẫn được nếu muốn — ở đây mọi user).
drop policy if exists dg_select on public.default_games;
create policy dg_select on public.default_games for select using (true);
-- Ghi: chỉ super-admin.
drop policy if exists dg_write on public.default_games;
create policy dg_write on public.default_games for all
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Seed game "Ai Là Triệu Phú" (bundle trong repo).
insert into public.default_games (key, title, icon, play_url, source, order_index)
values ('ai-la-trieu-phu', 'Ai Là Triệu Phú', '💰', '/games/ai-la-trieu-phu/index.html', 'builtin', 0)
on conflict (key) do nothing;

-- ---- Supabase Storage: bucket công khai cho game tải lên ----
insert into storage.buckets (id, name, public)
values ('default-games', 'default-games', true)
on conflict (id) do nothing;

-- Đọc file: công khai. Ghi/sửa/xoá: chỉ super-admin.
drop policy if exists dg_obj_read on storage.objects;
create policy dg_obj_read on storage.objects for select
  using (bucket_id = 'default-games');
drop policy if exists dg_obj_insert on storage.objects;
create policy dg_obj_insert on storage.objects for insert
  with check (bucket_id = 'default-games' and public.is_superadmin());
drop policy if exists dg_obj_update on storage.objects;
create policy dg_obj_update on storage.objects for update
  using (bucket_id = 'default-games' and public.is_superadmin());
drop policy if exists dg_obj_delete on storage.objects;
create policy dg_obj_delete on storage.objects for delete
  using (bucket_id = 'default-games' and public.is_superadmin());
