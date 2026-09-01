-- Thi online v3: tự đồng bộ điểm sang bảng điểm lớp khi nộp + xem lại bài (đúng/sai).

-- exam_submit: chấm + (mới) tự ghi điểm vào cột điểm của đề (nếu có) -> hiện luôn ở tab Điểm số.
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
  if v_exam.status <> 'started' then raise exception 'Đề thi chưa bắt đầu hoặc đã đóng'; end if;
  select count(*) into v_total from exam_questions where exam_id = v_exam.id;
  select count(*) into v_correct from exam_questions q
    where q.exam_id = v_exam.id and (p_answers ->> q.id::text)::int = q.correct;
  v_score := case when v_total > 0 then round(10.0 * v_correct / v_total, 1) else 0 end;
  update exam_attempts set answers = p_answers, score = v_score, correct_count = v_correct,
    total = v_total, status = 'submitted', submitted_at = now() where id = p_attempt_id;
  -- Đồng bộ điểm sang bảng điểm lớp (best-effort, không chặn nộp nếu lỗi)
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

-- Xem lại bài: trả câu hỏi + đáp án đúng + đáp án đã chọn — CHỈ khi đã nộp.
create or replace function public.exam_review(p_attempt_id uuid)
returns json language sql security definer set search_path = public stable as $$
  select case when a.status = 'submitted' then json_build_object(
      'name', a.student_name, 'score', a.score, 'correct', a.correct_count, 'total', a.total,
      'questions', coalesce((
        select json_agg(json_build_object('text', q.text, 'options', q.options, 'correct', q.correct,
                                           'chosen', (a.answers ->> q.id::text)::int) order by q.order_index)
        from exam_questions q where q.exam_id = a.exam_id), '[]'::json))
    else json_build_object('error', 'Chưa nộp bài') end
  from exam_attempts a where a.id = p_attempt_id;
$$;

grant execute on function public.exam_submit(uuid, jsonb) to anon, authenticated;
grant execute on function public.exam_review(uuid) to anon, authenticated;
