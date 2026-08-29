-- =====================================================================
--  Đợt 2 super-admin: Sổ ghi nhận thanh toán
--  Chạy 1 lần trong SQL Editor của Supabase (project giaoly).
-- =====================================================================

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  parish_id     uuid references public.parishes(id) on delete set null,
  amount        bigint not null default 0,       -- số tiền (VND)
  method        text,                            -- bank | vietqr | cash | other
  tier          text,                            -- bậc/gói (ghi chú)
  discount_code text,                            -- mã giảm giá đã dùng (Đợt 3)
  note          text,
  paid_at       date not null default current_date,
  created_at    timestamptz not null default now()
);

-- RLS bật, KHÔNG policy => chỉ service_role (Edge Function super-admin) đọc/ghi.
alter table public.payments enable row level security;
