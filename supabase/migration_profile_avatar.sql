-- =====================================================================
--  Ảnh đại diện cá nhân + sửa chữ tính năng giấy khen
--  Chạy 1 lần trong SQL Editor.
-- =====================================================================

-- Ảnh đại diện tài khoản (data-URL, mỗi người tự đổi; RLS profile_update đã cho tự sửa)
alter table public.profiles add column if not exists avatar_url text;

-- "Sinh giấy khen" -> "Tạo giấy khen"
update public.features
  set description = 'Tạo giấy khen / chứng nhận từ dữ liệu học viên, xuất PDF.'
  where key = 'certificate';
