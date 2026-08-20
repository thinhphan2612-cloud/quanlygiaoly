-- =====================================================================
--  QUẢN LÝ GIÁO LÝ — Schema Supabase (multi-tenant SaaS)
--  Đợt 1: giáo xứ, tài khoản, lớp, học viên, điểm danh (giáo lý + việc
--  thiêng liêng), điểm số (cột điểm + hệ số), năm học / nhảy lớp.
--
--  Cách dùng: mở Supabase → SQL Editor → dán toàn bộ file này → Run.
--  Chạy lại được nhiều lần (idempotent ở mức tạo bảng/policy).
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- =====================================================================
--  1. GIÁO XỨ (tenant)
-- =====================================================================
create table if not exists public.parishes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                       -- tên giáo xứ
  diocese     text,                                -- tên giáo phận
  logo_url    text,
  plan        text not null default 'free',        -- free | standard | pro
  -- settings: các cờ bật/tắt (mặc định ON), năm học hiện tại, v.v.
  settings    jsonb not null default '{
    "current_school_year": null,
    "manage_by_school_year": true,
    "auto_promote": true,
    "show_graduated": true
  }'::jsonb,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  2. PROFILES (mở rộng auth.users) — admin | teacher (giáo lý viên)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  parish_id   uuid references public.parishes(id) on delete cascade,
  role        text not null default 'teacher',     -- admin | teacher
  full_name   text not null default '',
  saint_name  text,                                -- tên thánh
  -- Thông tin cá nhân giáo lý viên (feedback trang admin / GLV)
  birth_date  date,
  address     text,
  area        text,                                -- khu vực (khu mấy)
  glv_level   text,                                -- cấp giáo lý viên (1,2 - để trống cha tự điền)
  occupation  text,                                -- nghề nghiệp
  phone       text,
  created_at  timestamptz not null default now()
);

-- Helper: parish_id của user đang đăng nhập (dùng trong mọi RLS policy)
create or replace function public.current_parish_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select parish_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- Trigger: khi có user mới đăng ký → tạo giáo xứ + profile admin.
-- Metadata khi signup: { full_name, parish_name, diocese }.
-- (Tài khoản giáo lý viên do admin thêm sau — thiết kế ở đợt sau.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_parish_id uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Nếu signup có kèm parish_id (được admin mời) thì gắn vào, role teacher.
  if (meta ? 'parish_id') and (meta->>'parish_id') <> '' then
    insert into public.profiles (id, parish_id, role, full_name)
    values (new.id, (meta->>'parish_id')::uuid, coalesce(meta->>'role','teacher'),
            coalesce(meta->>'full_name',''));
  else
    -- Ngược lại: tạo giáo xứ mới, user là admin của giáo xứ đó.
    insert into public.parishes (name, diocese)
    values (coalesce(meta->>'parish_name','Giáo xứ mới'), meta->>'diocese')
    returning id into new_parish_id;

    insert into public.profiles (id, parish_id, role, full_name)
    values (new.id, new_parish_id, 'admin', coalesce(meta->>'full_name',''));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  3. NĂM HỌC GIÁO LÝ
-- =====================================================================
create table if not exists public.school_years (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  name        text not null,                       -- vd "2025-2026"
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- =====================================================================
--  4. LỚP HỌC
-- =====================================================================
create table if not exists public.classes (
  id           uuid primary key default gen_random_uuid(),
  parish_id    uuid not null references public.parishes(id) on delete cascade,
  name         text not null,
  school_year  text,                               -- vd "2025-2026"
  order_index  int  not null default 0,            -- thứ tự lớp (để auto nhảy lớp)
  room         text,                               -- phòng học, vd A102
  schedule     text,                               -- thời gian học: sáng/chiều/tối
  graduated    boolean not null default false,     -- lớp đã ra trường (lưu trữ)
  created_at   timestamptz not null default now()
);

-- Nhiều giáo lý viên / lớp (chính + phụ)
create table if not exists public.class_teachers (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  is_primary  boolean not null default false,      -- true = giáo viên chính
  unique (class_id, teacher_id)
);

-- =====================================================================
--  5. HỌC VIÊN
-- =====================================================================
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  parish_id     uuid not null references public.parishes(id) on delete cascade,
  full_name     text not null,
  saint_name    text,
  birth_date    date,
  gender        text,
  parent_name   text,
  parent_phone  text,
  student_phone text,
  address       text,
  class_id      uuid references public.classes(id) on delete set null,
  notes         text,
  position      text,                              -- chức vụ: lớp trưởng, lớp phó...
  sacrament     text not null default 'none',      -- none | vo_long | ruoc_le | them_suc  (TODO: xác nhận với Felix, có thể tách bool)
  graduated     boolean not null default false,    -- học viên đã ra trường
  created_at    timestamptz not null default now()
);

-- =====================================================================
--  6. ĐIỂM DANH — 2 loại: giáo lý & việc thiêng liêng
-- =====================================================================
-- Điểm danh giáo lý (buổi học, thường Chúa Nhật)
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  date        date not null,
  status      text not null default 'present',     -- present | absent | late
  unique (student_id, date)
);

-- Danh mục "việc thiêng liêng" (Đi lễ, Đọc kinh...) — admin tạo thêm
create table if not exists public.spiritual_tasks (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  name        text not null,                       -- Đi lễ, Đọc kinh...
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

-- Bản ghi hoàn thành việc thiêng liêng (check theo ngày)
create table if not exists public.spiritual_records (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  task_id     uuid not null references public.spiritual_tasks(id) on delete cascade,
  date        date not null,
  done        boolean not null default false,
  unique (student_id, task_id, date)
);

-- =====================================================================
--  7. ĐIỂM SỐ — cột điểm (có hệ số) + điểm từng học viên
-- =====================================================================
create table if not exists public.grade_columns (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete cascade,
  name        text not null,                       -- vd "Kiểm tra 15'"
  weight      numeric not null default 1,          -- hệ số
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.grades (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  column_id   uuid references public.grade_columns(id) on delete cascade,
  score       numeric not null,
  date        date not null default current_date,
  unique (student_id, column_id)
);

-- =====================================================================
--  8. ROW LEVEL SECURITY — cách ly dữ liệu theo giáo xứ
-- =====================================================================
alter table public.parishes         enable row level security;
alter table public.profiles         enable row level security;
alter table public.school_years     enable row level security;
alter table public.classes          enable row level security;
alter table public.class_teachers   enable row level security;
alter table public.students         enable row level security;
alter table public.attendance       enable row level security;
alter table public.spiritual_tasks  enable row level security;
alter table public.spiritual_records enable row level security;
alter table public.grade_columns    enable row level security;
alter table public.grades           enable row level security;

-- parishes: xem/sửa giáo xứ của mình
drop policy if exists parish_rw on public.parishes;
create policy parish_rw on public.parishes
  for all using (id = public.current_parish_id())
  with check (id = public.current_parish_id());

-- profiles: xem người cùng giáo xứ; tự sửa mình; admin sửa mọi profile trong xứ
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles
  for select using (parish_id = public.current_parish_id());
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (parish_id = public.current_parish_id());
drop policy if exists profile_delete on public.profiles;
create policy profile_delete on public.profiles
  for delete using (public.is_admin() and parish_id = public.current_parish_id());

-- Macro-style policy cho các bảng dữ liệu còn lại (đều lọc theo parish_id).
-- Postgres không có "for each table", nên khai báo tường minh từng bảng.
do $$
declare t text;
begin
  foreach t in array array[
    'school_years','classes','class_teachers','students','attendance',
    'spiritual_tasks','spiritual_records','grade_columns','grades'
  ] loop
    execute format('drop policy if exists tenant_rw on public.%I;', t);
    if t = 'class_teachers' then
      -- class_teachers không có parish_id trực tiếp → lọc qua class
      execute '
        create policy tenant_rw on public.class_teachers for all
        using (exists (select 1 from public.classes c
                       where c.id = class_teachers.class_id
                         and c.parish_id = public.current_parish_id()))
        with check (exists (select 1 from public.classes c
                            where c.id = class_teachers.class_id
                              and c.parish_id = public.current_parish_id()))';
    else
      execute format('
        create policy tenant_rw on public.%I for all
        using (parish_id = public.current_parish_id())
        with check (parish_id = public.current_parish_id())', t);
    end if;
  end loop;
end $$;

-- =====================================================================
--  9. INDEXES thường dùng
-- =====================================================================
create index if not exists idx_students_parish   on public.students(parish_id);
create index if not exists idx_students_class     on public.students(class_id);
create index if not exists idx_classes_parish     on public.classes(parish_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_date    on public.attendance(date);
create index if not exists idx_grades_student     on public.grades(student_id);
create index if not exists idx_spiritual_rec      on public.spiritual_records(student_id, date);

-- =====================================================================
--  HẾT. Đợt sau: notifications (thông báo admin↔GV), transactions
--  (kiểm toán thu chi), plan/billing (Free/Pro), game.
-- =====================================================================
