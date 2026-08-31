-- Bổ sung snapshot chi tiết cho đơn chốt lớp:
--   details = { [student_id]: { name, score, reason } }
--   - name:   tên hiển thị (thánh + họ tên) lúc gửi
--   - score:  điểm cuối kỳ (trung bình có hệ số) lúc gửi, number | null
--   - reason: lý do ở lại (chỉ dùng khi quyết định 'stay')
alter table public.class_reviews
  add column if not exists details jsonb not null default '{}'::jsonb;
