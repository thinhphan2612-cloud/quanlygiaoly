-- =====================================================================
--  Điểm danh: gỡ mọi CHECK constraint trên bảng attendance.
--  Bảng attendance thiết kế chỉ có NOT NULL + UNIQUE(student_id,date),
--  không có CHECK hợp lệ nào. Nếu tồn tại CHECK (vd date < current_date
--  thêm tay trên Supabase) sẽ chặn lưu điểm danh cho hôm nay -> gỡ bỏ.
--  Chạy 1 lần trong SQL Editor.
-- =====================================================================
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'attendance' and con.contype = 'c'
  loop
    execute format('alter table public.attendance drop constraint %I', c.conname);
    raise notice 'Đã gỡ CHECK constraint: %', c.conname;
  end loop;
end $$;

-- Kiểm tra còn constraint nào trên attendance (để đối chiếu).
select con.conname, con.contype
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public' and rel.relname = 'attendance';
