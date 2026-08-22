-- Ảnh đại diện học viên (data-URL). Chạy 1 lần trong SQL Editor.
alter table public.students add column if not exists avatar_url text;
