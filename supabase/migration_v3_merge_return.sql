-- v3: lớp gộp (tạo từ học viên có sẵn) + cho phép trả học viên về lớp cũ.
-- Chạy 1 lần trong SQL Editor.
alter table public.students add column if not exists prev_class_id uuid; -- lớp trước khi bị gộp
alter table public.classes  add column if not exists merged boolean not null default false; -- lớp gộp (hè/ngoại khóa)
