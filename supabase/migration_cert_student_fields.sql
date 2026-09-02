-- Bổ sung các trường chi tiết cho chứng chỉ Rửa Tội & Thêm Sức (in tự động, nhập 1 lần).
alter table public.students
  add column if not exists birth_place            text,  -- nơi sinh
  add column if not exists origin_place           text,  -- nguyên quán
  add column if not exists residence              text,  -- trú quán
  add column if not exists baptism_church         text,  -- nhà thờ rửa tội
  add column if not exists baptism_book_no        text,  -- số trích sổ rửa tội
  add column if not exists baptism_priest         text,  -- linh mục rửa tội
  add column if not exists confirmation_church     text,  -- nhà thờ thêm sức
  add column if not exists confirmation_bishop     text,  -- giám mục thêm sức
  add column if not exists confirmation_godparent  text,  -- người đỡ đầu thêm sức
  add column if not exists confirmation_book_no    text;  -- số trích sổ thêm sức
