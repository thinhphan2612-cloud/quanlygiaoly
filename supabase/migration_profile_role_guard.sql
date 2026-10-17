-- Vá phân quyền bảng profiles (chạy TAY trong Supabase SQL Editor).
--
-- Lỗ 1: policy profile_update cho mỗi người tự sửa hồ sơ của mình (id = auth.uid()) nhưng
--       không chặn cột role -> giáo lý viên gọi API trực tiếp có thể tự đặt role = 'admin'.
-- Lỗ 2: điều kiện public.is_admin() không lọc giáo xứ -> admin giáo xứ A sửa được hồ sơ
--       người dùng giáo xứ B nếu biết id (và kéo người đó sang giáo xứ A).
--
-- Sau khi chạy:
--  * Mỗi người vẫn tự sửa họ tên, ảnh đại diện... của mình.
--  * Chỉ admin của CÙNG giáo xứ mới sửa được hồ sơ người khác.
--  * Đổi role chỉ admin làm được, không tự đổi role của chính mình, không đổi parish_id.
--  * Edge Functions dùng service_role (create-teacher, admin-api, provision...) không bị ảnh hưởng.

drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update using (
    id = auth.uid()
    or (public.is_admin() and parish_id = public.current_parish_id())
  )
  with check (parish_id = public.current_parish_id());

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Máy chủ (service_role, SQL Editor) được đổi tự do
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if new.parish_id is distinct from old.parish_id then
    raise exception 'Không được đổi giáo xứ của tài khoản';
  end if;
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'Chỉ quản trị viên mới đổi được vai trò';
    end if;
    if new.id = auth.uid() then
      raise exception 'Không thể tự đổi vai trò của chính mình';
    end if;
    if new.role not in ('admin', 'teacher') then
      raise exception 'Vai trò không hợp lệ';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();
