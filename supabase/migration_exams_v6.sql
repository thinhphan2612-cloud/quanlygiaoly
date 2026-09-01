-- Thi online v6: đếm số lần học viên RỜI màn hình thi (đổi app/tab để tra cứu/chụp màn hình).
alter table public.exam_attempts add column if not exists leave_count int not null default 0;

create or replace function public.exam_leave(p_attempt_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update exam_attempts set leave_count = coalesce(leave_count, 0) + 1
    where id = p_attempt_id and status <> 'submitted'
    returning leave_count into v;
  return coalesce(v, 0);
end $$;
grant execute on function public.exam_leave(uuid) to anon, authenticated;
