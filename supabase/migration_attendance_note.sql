-- Ghi chú lý do cho điểm danh (dùng cho "vắng có phép"). Chạy 1 lần.
alter table public.attendance add column if not exists note text;
-- status giờ nhận: present | late | absent (vắng không phép) | excused (vắng có phép)
