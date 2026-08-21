-- =====================================================================
--  KHÓA CỨNG RLS THEO LỚP — giáo lý viên chỉ truy cập lớp mình phụ trách
--  Admin: toàn quyền trong giáo xứ. GLV: chỉ lớp được phân công.
--  Chạy 1 lần trong Supabase → SQL Editor.
-- =====================================================================

-- Helper (SECURITY DEFINER: bỏ qua RLS bên trong, tránh đệ quy)
create or replace function public.teaches_class(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_teachers ct
                 where ct.class_id = cid and ct.teacher_id = auth.uid())
$$;

create or replace function public.teaches_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s
                 join public.class_teachers ct on ct.class_id = s.class_id
                 where s.id = sid and ct.teacher_id = auth.uid())
$$;

-- ---------- CLASSES: admin toàn quyền; GLV chỉ XEM lớp mình ----------
drop policy if exists tenant_rw on public.classes;
drop policy if exists classes_admin on public.classes;
drop policy if exists classes_teacher_sel on public.classes;
create policy classes_admin on public.classes for all
  using (public.is_admin() and parish_id = public.current_parish_id())
  with check (public.is_admin() and parish_id = public.current_parish_id());
create policy classes_teacher_sel on public.classes for select
  using (parish_id = public.current_parish_id() and public.teaches_class(id));

-- ---------- CLASS_TEACHERS: admin toàn quyền; GLV xem lớp mình ----------
drop policy if exists tenant_rw on public.class_teachers;
drop policy if exists ct_admin on public.class_teachers;
drop policy if exists ct_teacher_sel on public.class_teachers;
create policy ct_admin on public.class_teachers for all
  using (public.is_admin() and exists (select 1 from public.classes c where c.id = class_teachers.class_id and c.parish_id = public.current_parish_id()))
  with check (public.is_admin() and exists (select 1 from public.classes c where c.id = class_teachers.class_id and c.parish_id = public.current_parish_id()));
create policy ct_teacher_sel on public.class_teachers for select
  using (public.teaches_class(class_id));

-- ---------- STUDENTS ----------
drop policy if exists tenant_rw on public.students;
create policy students_rw on public.students for all
  using (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_class(class_id)))
  with check (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_class(class_id)));

-- ---------- ATTENDANCE ----------
drop policy if exists tenant_rw on public.attendance;
create policy attendance_rw on public.attendance for all
  using (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)))
  with check (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)));

-- ---------- GRADE_COLUMNS ----------
drop policy if exists tenant_rw on public.grade_columns;
create policy gcol_rw on public.grade_columns for all
  using (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_class(class_id)))
  with check (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_class(class_id)));

-- ---------- GRADES ----------
drop policy if exists tenant_rw on public.grades;
create policy grades_rw on public.grades for all
  using (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)))
  with check (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)));

-- ---------- SPIRITUAL_RECORDS ----------
drop policy if exists tenant_rw on public.spiritual_records;
create policy sprec_rw on public.spiritual_records for all
  using (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)))
  with check (parish_id = public.current_parish_id() and (public.is_admin() or public.teaches_student(student_id)));

-- ---------- TRANSACTIONS: chỉ admin (GLV không truy cập kiểm toán) ----------
drop policy if exists tenant_rw on public.transactions;
drop policy if exists tx_admin on public.transactions;
create policy tx_admin on public.transactions for all
  using (parish_id = public.current_parish_id() and public.is_admin())
  with check (parish_id = public.current_parish_id() and public.is_admin());

-- Ghi chú: school_years, spiritual_tasks, profiles, parishes vẫn ở phạm vi giáo xứ
-- (cấu hình chung + tên người) — GLV đọc được, không phải dữ liệu lớp nhạy cảm.
