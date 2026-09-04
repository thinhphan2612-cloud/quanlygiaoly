-- =====================================================================
--  Hạn mức đăng ký theo IP: chống 1 IP spam gửi email mời tạo tài khoản.
--  Chỉ service_role ghi/đọc (function register-invite). RLS bật, không policy.
-- =====================================================================
create table if not exists public.register_invites (
  id         bigint generated always as identity primary key,
  ip         text not null,
  email      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_register_invites_ip_time on public.register_invites (ip, created_at desc);
alter table public.register_invites enable row level security;
