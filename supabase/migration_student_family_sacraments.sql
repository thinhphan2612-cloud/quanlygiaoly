-- Mở rộng hồ sơ học viên: cha & mẹ (tên thánh, họ tên, SĐT), người đỡ đầu,
-- và ngày các bí tích. Chạy 1 lần trong SQL Editor.
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
  add column if not exists confirmation_date    date;   -- ngày thêm sức
