-- Thi online v4: cho phép nộp khi đề 'started' HOẶC 'closed'
-- (để tự nộp bài khi GLV bấm Kết thúc / khi hết giờ — câu chưa làm tính sai).
create or replace function public.exam_submit(p_attempt_id uuid, p_answers jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_att exam_attempts; v_exam exams; v_total int; v_correct int; v_score numeric;
begin
  select * into v_att from exam_attempts where id = p_attempt_id;
  if v_att.id is null then raise exception 'Không tìm thấy bài làm'; end if;
  if v_att.status = 'submitted' then
    return json_build_object('score', v_att.score, 'correct', v_att.correct_count, 'total', v_att.total, 'already', true);
  end if;
  select * into v_exam from exams where id = v_att.exam_id;
  if v_exam.status not in ('started', 'closed') then raise exception 'Đề thi chưa bắt đầu'; end if;
  select count(*) into v_total from exam_questions where exam_id = v_exam.id;
  select count(*) into v_correct from exam_questions q
    where q.exam_id = v_exam.id and (p_answers ->> q.id::text)::int = q.correct;
  v_score := case when v_total > 0 then round(10.0 * v_correct / v_total, 1) else 0 end;
  update exam_attempts set answers = p_answers, score = v_score, correct_count = v_correct,
    total = v_total, status = 'submitted', submitted_at = now() where id = p_attempt_id;
  if v_exam.grade_column_id is not null and v_att.student_id is not null then
    begin
      insert into grades (parish_id, student_id, column_id, score)
        values (v_exam.parish_id, v_att.student_id, v_exam.grade_column_id, v_score)
        on conflict (student_id, column_id) do update set score = excluded.score;
    exception when others then null;
    end;
  end if;
  return json_build_object('score', v_score, 'correct', v_correct, 'total', v_total);
end $$;
grant execute on function public.exam_submit(uuid, jsonb) to anon, authenticated;
