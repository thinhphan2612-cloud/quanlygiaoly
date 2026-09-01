-- =============================================================
--  THI ONLINE (gói Pro): GLV soạn đề trắc nghiệm gắn với 1 lớp,
--  học viên quét QR -> chọn tên trong lớp -> chờ bắt đầu -> làm bài
--  (đề dạng 1 tờ, cuộn) -> nộp -> server tự chấm -> lưu điểm.
--  Bảo mật: đáp án đúng (exam_questions.correct) KHÔNG lộ cho anon;
--  học viên chỉ tương tác qua RPC security-definer bên dưới.
-- =============================================================

create table if not exists public.exams (
  id           uuid primary key default gen_random_uuid(),
  parish_id    uuid not null references public.parishes(id) on delete cascade,
  class_id     uuid references public.classes(id) on delete set null,
  teacher_id   uuid,
  title        text not null,
  kind         text not null default '15p',    -- 15p | 1tiet | hocky | khac
  weight       numeric not null default 1,      -- hệ số điểm
  code         text unique not null,            -- mã công khai (QR)
  status       text not null default 'draft',   -- draft | waiting | started | closed
  duration_min int,
  created_at   timestamptz default now()
);

create table if not exists public.exam_questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams(id) on delete cascade,
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  order_index int not null default 0,
  text        text not null,
  options     jsonb not null,                   -- ["A","B","C","D"]
  correct     int not null                      -- 0-based (ẩn với anon)
);
create index if not exists idx_eq_exam on public.exam_questions(exam_id);

create table if not exists public.exam_attempts (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams(id) on delete cascade,
  parish_id     uuid not null references public.parishes(id) on delete cascade,
  student_id    uuid references public.students(id) on delete set null,
  student_name  text not null,
  answers       jsonb,                          -- { "<question_id>": <chosen_index> }
  score         numeric, correct_count int, total int,
  status        text not null default 'joined', -- joined | submitted
  joined_at     timestamptz default now(),
  submitted_at  timestamptz,
  unique (exam_id, student_id)
);
create index if not exists idx_ea_exam on public.exam_attempts(exam_id);

-- ---- RLS: chỉ thành viên giáo xứ (GLV/Admin) thao tác; anon KHÔNG có quyền bảng ----
alter table public.exams enable row level security;
drop policy if exists exams_rw on public.exams;
create policy exams_rw on public.exams for all
  using (parish_id = public.current_parish_id()) with check (parish_id = public.current_parish_id());

alter table public.exam_questions enable row level security;
drop policy if exists eq_rw on public.exam_questions;
create policy eq_rw on public.exam_questions for all
  using (parish_id = public.current_parish_id()) with check (parish_id = public.current_parish_id());

alter table public.exam_attempts enable row level security;
drop policy if exists ea_rw on public.exam_attempts;
create policy ea_rw on public.exam_attempts for all
  using (parish_id = public.current_parish_id()) with check (parish_id = public.current_parish_id());

-- =============================================================
--  RPC công khai cho học viên (security definer, ẩn đáp án)
-- =============================================================

-- Thông tin đề (không có đáp án) — dùng cho lobby + polling trạng thái.
create or replace function public.exam_public(p_code text)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'id', e.id, 'title', e.title, 'kind', e.kind, 'status', e.status,
    'class_id', e.class_id, 'class_name', c.name, 'duration_min', e.duration_min,
    'num_questions', (select count(*) from exam_questions q where q.exam_id = e.id)
  ) from exams e left join classes c on c.id = e.class_id where e.code = p_code;
$$;

-- Danh sách học viên của lớp thi (để chọn tên).
create or replace function public.exam_roster(p_code text)
returns table(id uuid, name text) language sql security definer set search_path = public stable as $$
  select s.id, coalesce(nullif(btrim(coalesce(s.saint_name,'') || ' ' || s.full_name), ''), s.full_name)
  from students s join exams e on e.class_id = s.class_id
  where e.code = p_code and s.graduated = false
  order by s.full_name;
$$;

-- Học viên vào phòng thi (tạo/lấy attempt). Chỉ khi đề đang mở.
create or replace function public.exam_join(p_code text, p_student_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_exam exams; v_name text; v_id uuid;
begin
  select * into v_exam from exams where code = p_code;
  if v_exam.id is null then raise exception 'Không tìm thấy đề thi'; end if;
  if v_exam.status not in ('waiting','started') then raise exception 'Đề thi chưa mở hoặc đã đóng'; end if;
  select coalesce(nullif(btrim(coalesce(saint_name,'') || ' ' || full_name), ''), full_name)
    into v_name from students where id = p_student_id and class_id = v_exam.class_id and graduated = false;
  if v_name is null then raise exception 'Học viên không thuộc lớp thi'; end if;
  insert into exam_attempts (exam_id, parish_id, student_id, student_name)
    values (v_exam.id, v_exam.parish_id, p_student_id, v_name)
    on conflict (exam_id, student_id) do update set student_name = excluded.student_name
    returning id into v_id;
  return v_id;
end $$;

-- Lấy đề (KHÔNG đáp án) — chỉ khi đã 'started'.
create or replace function public.exam_take(p_code text)
returns json language sql security definer set search_path = public stable as $$
  select case when e.status = 'started' then
    coalesce((select json_agg(json_build_object('id', q.id, 'text', q.text, 'options', q.options) order by q.order_index)
              from exam_questions q where q.exam_id = e.id), '[]'::json)
    else '[]'::json end
  from exams e where e.code = p_code;
$$;

-- Nộp bài -> chấm phía server -> lưu điểm. Không cho nộp lại.
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
  return json_build_object('score', v_score, 'correct', v_correct, 'total', v_total);
end $$;

grant execute on function public.exam_public(text)   to anon, authenticated;
grant execute on function public.exam_roster(text)   to anon, authenticated;
grant execute on function public.exam_join(text,uuid) to anon, authenticated;
grant execute on function public.exam_take(text)     to anon, authenticated;
grant execute on function public.exam_submit(uuid,jsonb) to anon, authenticated;
