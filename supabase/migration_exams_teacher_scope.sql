-- Khóa đề thi theo lớp (chạy TAY trong Supabase SQL Editor), cùng kiểu migration_rls_teacher_scope.sql.
--
-- Lỗ: exams, exam_questions, exam_attempts chỉ lọc theo giáo xứ -> giáo lý viên lớp A xem được đề,
--     tên và điểm học viên lớp B, và xóa được đề của lớp B.
--
-- Sau khi chạy:
--  * Quản trị viên: toàn quyền đề thi trong giáo xứ.
--  * Giáo lý viên: xem/sửa/xóa đề của lớp mình phụ trách hoặc đề do chính mình tạo;
--    chỉ tạo đề (hoặc đổi lớp của đề) cho lớp mình phụ trách.
--  * Học viên làm bài qua các hàm security definer (exam_public, exam_join, exam_begin, exam_submit...)
--    nên không bị ảnh hưởng.
-- Cần đã chạy migration_rls_teacher_scope.sql (hàm teaches_class).

-- Người đang đăng nhập có được truy cập đề này không (security definer: đọc exams không qua RLS, tránh đệ quy)
create or replace function public.can_access_exam(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exams e
    where e.id = eid and e.parish_id = public.current_parish_id()
      and (public.is_admin() or e.teacher_id = auth.uid() or (e.class_id is not null and public.teaches_class(e.class_id)))
  )
$$;

-- ---------- EXAMS ----------
drop policy if exists exams_rw on public.exams;
drop policy if exists exams_sel on public.exams;
drop policy if exists exams_ins on public.exams;
drop policy if exists exams_upd on public.exams;
drop policy if exists exams_del on public.exams;
create policy exams_sel on public.exams for select
  using (parish_id = public.current_parish_id()
         and (public.is_admin() or teacher_id = auth.uid() or (class_id is not null and public.teaches_class(class_id))));
create policy exams_ins on public.exams for insert
  with check (parish_id = public.current_parish_id()
              and (public.is_admin() or (teacher_id = auth.uid() and public.teaches_class(class_id))));
create policy exams_upd on public.exams for update
  using (parish_id = public.current_parish_id()
         and (public.is_admin() or teacher_id = auth.uid() or (class_id is not null and public.teaches_class(class_id))))
  with check (parish_id = public.current_parish_id()
              and (public.is_admin() or (class_id is not null and public.teaches_class(class_id)) or (class_id is null and teacher_id = auth.uid())));
create policy exams_del on public.exams for delete
  using (parish_id = public.current_parish_id()
         and (public.is_admin() or teacher_id = auth.uid() or (class_id is not null and public.teaches_class(class_id))));

-- ---------- EXAM_QUESTIONS / EXAM_ATTEMPTS: theo quyền với đề ----------
drop policy if exists eq_rw on public.exam_questions;
create policy eq_rw on public.exam_questions for all
  using (parish_id = public.current_parish_id() and public.can_access_exam(exam_id))
  with check (parish_id = public.current_parish_id() and public.can_access_exam(exam_id));

drop policy if exists ea_rw on public.exam_attempts;
create policy ea_rw on public.exam_attempts for all
  using (parish_id = public.current_parish_id() and public.can_access_exam(exam_id))
  with check (parish_id = public.current_parish_id() and public.can_access_exam(exam_id));
