-- =====================================================================
--  PHASE TÀI KHOẢN GIÁO LÝ VIÊN — vá bảo mật trigger + cột email
--  Chạy 1 lần trong Supabase → SQL Editor.
-- =====================================================================

-- 1) Thêm cột email vào profiles (để hiển thị danh sách GLV)
alter table public.profiles add column if not exists email text;

-- 2) Thay trigger tạo user:
--    - Đăng ký MỚI (không kèm parish_id) -> tạo giáo xứ + admin (như cũ).
--    - Có parish_id (tài khoản GLV do Edge Function tạo) -> KHÔNG tạo profile ở
--      trigger nữa (Edge Function tự chèn profile với parish_id đã xác thực).
--      => chặn việc đăng ký công khai tự gắn vào giáo xứ khác.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_parish_id uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if (meta ? 'parish_id') and (meta->>'parish_id') <> '' then
    return new;  -- GLV: để Edge Function (service_role) tạo profile
  end if;

  insert into public.parishes (name, diocese)
  values (coalesce(meta->>'parish_name', 'Giáo xứ mới'), meta->>'diocese')
  returning id into new_parish_id;

  insert into public.profiles (id, parish_id, role, full_name, email)
  values (new.id, new_parish_id, 'admin', coalesce(meta->>'full_name', ''), new.email);
  return new;
end;
$$;
