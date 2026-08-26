-- v4: liên kết học viên qua các năm (để xem lịch sử điểm).
-- origin_id = mã "con người" bền vững; khi lên lớp, bản copy giữ cùng origin_id.
-- Bản ghi gốc để null (khóa lịch sử = coalesce(origin_id, id)).
alter table public.students add column if not exists origin_id uuid;
create index if not exists students_origin_idx on public.students (origin_id);
