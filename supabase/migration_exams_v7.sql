-- Thi online v7: exam_begin trả thêm leave_count để trang thi hiện lại cảnh báo
-- sau khi iOS tải lại trang (số lần rời vẫn được ghi trên server).
create or replace function public.exam_begin(p_attempt_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_att exam_attempts; v_exam exams;
begin
  select * into v_att from exam_attempts where id = p_attempt_id;
  if v_att.id is null then raise exception 'Không tìm thấy bài làm'; end if;
  select * into v_exam from exams where id = v_att.exam_id;
  if v_exam.status <> 'started' then raise exception 'Đề chưa bắt đầu'; end if;
  if v_att.started_at is null and v_att.status <> 'submitted' then
    update exam_attempts set started_at = now() where id = p_attempt_id returning started_at into v_att.started_at;
  end if;
  return json_build_object(
    'started_at', v_att.started_at, 'server_now', now(),
    'duration_min', v_exam.duration_min, 'submitted', (v_att.status = 'submitted'),
    'score', v_att.score, 'correct', v_att.correct_count, 'total', v_att.total,
    'leave_count', coalesce(v_att.leave_count, 0)
  );
end $$;
grant execute on function public.exam_begin(uuid) to anon, authenticated;
