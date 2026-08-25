-- ================================================================
-- Nâng cấp v2: hồ sơ cha/mẹ + bí tích có ngày, chứng chỉ,
-- lớp có cờ tự lên lớp, và mô hình lưu trữ theo năm học (copy).
-- Chạy 1 lần trong Supabase SQL Editor. Idempotent (add if not exists).
-- ================================================================

-- 1) Hồ sơ học viên: cha & mẹ (tên thánh, họ tên, SĐT), người đỡ đầu,
--    ngày các bí tích, và danh sách chứng chỉ/khóa đã hoàn thành.
alter table public.students
  add column if not exists father_saint         text,
  add column if not exists father_name          text,
  add column if not exists father_phone         text,
  add column if not exists mother_saint         text,
  add column if not exists mother_name          text,
  add column if not exists mother_phone         text,
  add column if not exists godparent_name       text,
  add column if not exists baptism_date         date,   -- ngày rửa tội
  add column if not exists first_communion_date date,   -- ngày rước lễ lần đầu
  add column if not exists confirmation_date    date,   -- ngày thêm sức
  add column if not exists certificates         jsonb not null default '[]'::jsonb; -- [{name, date}]

-- 2) Lớp: cờ "tự động lên lớp cho năm sau".
--    Lớp hè / dự tòng / hôn nhân / đào tạo GLV = học 1 lần -> đặt false.
alter table public.classes
  add column if not exists promotes boolean not null default true;

-- Ghi chú mô hình lưu trữ theo năm (không cần thêm cột mới):
--   * classes.graduated = true  => lớp thuộc NĂM ĐÃ ĐÓNG BĂNG (lưu trữ)
--   * students.graduated = true => bản ghi học viên thuộc năm đã đóng băng
--   * năm học của một lớp/học viên suy từ classes.school_year
-- Khi "Kết thúc năm học & lên lớp":
--   - Nhân bản các lớp promotes=true sang năm mới (điểm reset),
--     học viên được COPY lên bậc kế tiếp; lớp cao nhất => ra trường.
--   - Toàn bộ lớp + học viên của năm cũ set graduated=true (đóng băng, tra cứu ở tab Lưu trữ).
