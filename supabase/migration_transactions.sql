-- =====================================================================
--  KIỂM TOÁN THU CHI — bảng transactions (chạy 1 lần trong SQL Editor)
-- =====================================================================
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  parish_id  uuid not null references public.parishes(id) on delete cascade,
  class_id   uuid references public.classes(id) on delete set null,  -- thu chi theo lớp (tùy chọn)
  content    text not null,                       -- tên nội dung
  type       text not null default 'thu',         -- 'thu' | 'chi'
  amount     numeric not null default 0,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
drop policy if exists tenant_rw on public.transactions;
create policy tenant_rw on public.transactions for all
  using (parish_id = public.current_parish_id())
  with check (parish_id = public.current_parish_id());

create index if not exists idx_transactions_parish on public.transactions(parish_id);
