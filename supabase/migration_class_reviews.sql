-- =============================================================
--  #5 — QUY TRÌNH CHỐT LỚP (GLV gửi duyệt -> Admin duyệt)
--  Thay cho "lên lớp tự động". Mỗi lớp có 1 đơn review cho năm học
--  hiện tại. Cuối kỳ, GLV chọn từng em (lên lớp / ở lại — hoặc
--  đậu / không đạt với lớp ngoài hệ thống) rồi gửi; Admin duyệt.
--  Chỉ khi MỌI lớp đang hoạt động được duyệt thì Admin mới
--  "Kết thúc năm học" được.
-- =============================================================

create table if not exists public.class_reviews (
  id           uuid primary key default gen_random_uuid(),
  parish_id    uuid not null references public.parishes(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  school_year  text,
  kind         text not null default 'catechism',       -- catechism | external
  status       text not null default 'submitted',        -- submitted | approved | revision
  decisions    jsonb not null default '{}'::jsonb,        -- { student_id: 'advance'|'stay'|'pass'|'fail' }
  admin_note   text,                                      -- ghi chú khi Admin yêu cầu xem lại
  submitted_by uuid,
  reviewed_by  uuid,
  submitted_at timestamptz default now(),
  reviewed_at  timestamptz,
  created_at   timestamptz default now(),
  unique (class_id)
);

create index if not exists idx_cr_parish on public.class_reviews(parish_id);

alter table public.class_reviews enable row level security;

-- Đọc: mọi thành viên trong giáo xứ. Ghi: thành viên trong giáo xứ
-- (luồng GLV gửi / Admin duyệt được kiểm soát ở tầng ứng dụng).
drop policy if exists cr_select on public.class_reviews;
create policy cr_select on public.class_reviews for select
  using (parish_id = public.current_parish_id());

drop policy if exists cr_write on public.class_reviews;
create policy cr_write on public.class_reviews for all
  using (parish_id = public.current_parish_id())
  with check (parish_id = public.current_parish_id());
