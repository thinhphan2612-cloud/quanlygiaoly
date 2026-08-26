-- v5: hàm trả LỊCH SỬ LỚP — mỗi học viên trong lớp (năm nay) kèm điểm TB các năm trước.
-- SECURITY DEFINER: tự kiểm tra quyền (admin cùng giáo xứ HOẶC GLV phụ trách lớp),
-- rồi truy origin_id để lấy dữ liệu năm cũ mà không cần nới RLS toàn cục.
create or replace function public.class_history(p_class uuid)
returns table(now_id uuid, saint_name text, full_name text, year text, class_name text, avg numeric)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  -- quyền truy cập
  if not exists (
    select 1 from classes c
    where c.id = p_class and (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.parish_id = c.parish_id)
      or exists (select 1 from class_teachers ct where ct.class_id = p_class and ct.teacher_id = auth.uid())
    )
  ) then
    return;
  end if;

  return query
  with now_students as (
    select s.id, s.saint_name, s.full_name, coalesce(s.origin_id, s.id) as okey
    from students s where s.class_id = p_class
  ),
  hist as (
    select ns.id as now_id, ns.saint_name, ns.full_name,
           cl.school_year as year, cl.name as class_name, hs.id as hs_id
    from now_students ns
    join students hs on coalesce(hs.origin_id, hs.id) = ns.okey
    join classes cl on cl.id = hs.class_id
  )
  select h.now_id, h.saint_name, h.full_name, h.year, h.class_name,
    (select round(sum(g.score * coalesce(gc.weight, 1)) / nullif(sum(coalesce(gc.weight, 1)), 0), 1)
       from grades g join grade_columns gc on gc.id = g.column_id
      where g.student_id = h.hs_id) as avg
  from hist h;
end;
$$;

grant execute on function public.class_history(uuid) to authenticated;
