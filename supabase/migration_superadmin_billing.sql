-- =====================================================================
--  Super-admin billing: khóa cột plan + hạn gói theo niên khóa
--  Chạy 1 lần trong SQL Editor của Supabase (project giaoly).
-- =====================================================================

-- 1) Hạn gói Pro (hết niên khóa). null = không giới hạn / gói free.
alter table public.parishes
  add column if not exists plan_expires_at timestamptz;

-- 2) Bịt lỗ hổng "tự lên Pro":
--    Thu quyền UPDATE toàn bảng của người dùng thường, chỉ cho sửa các cột
--    không nhạy cảm. => authenticated/anon KHÔNG đổi được plan / plan_expires_at.
--    Chỉ service_role (Edge Function admin-api của super-admin) đổi được.
revoke update on public.parishes from anon, authenticated;
grant  update (name, diocese, logo_url, settings) on public.parishes to authenticated;
