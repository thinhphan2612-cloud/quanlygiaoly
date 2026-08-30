-- =====================================================================
--  Đơn liên hệ & đăng ký dùng thử (leads) — thu từ landing giaoly.com.vn
--  Chạy 1 lần trong SQL Editor của Supabase (project giaoly).
-- =====================================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'contact',   -- 'contact' | 'register'
  name        text,
  email       text,
  phone       text,
  parish_name text,
  note        text,
  status      text not null default 'new',        -- 'new' | 'granted' | 'archived'
  created_at  timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Landing (anon) chỉ được GHI đơn; ĐỌC/SỬA chỉ service_role (super-admin qua admin-api).
grant insert on public.leads to anon, authenticated;
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to anon, authenticated with check (true);
