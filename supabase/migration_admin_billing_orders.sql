-- =====================================================================
--  Đợt 3 super-admin: bảng giá (sửa được) + mã giảm giá + đơn chờ (QR)
--  Chạy 1 lần trong SQL Editor của Supabase (project giaoly).
-- =====================================================================

-- 1) Bảng giá gói Pro (sửa được từ trang quản trị). price null = "Liên hệ".
create table if not exists public.plan_tiers (
  id          int primary key,
  label       text not null,
  price       bigint,                 -- VND; null = "Liên hệ" (không QR)
  order_index int not null default 0,
  active      boolean not null default true
);
alter table public.plan_tiers enable row level security;
drop policy if exists plan_tiers_read on public.plan_tiers;
create policy plan_tiers_read on public.plan_tiers for select using (true);  -- ai cũng đọc để hiện bảng giá
-- ghi chỉ service_role (super-admin qua admin-api)
insert into public.plan_tiers (id, label, price, order_index) values
  (1, 'Giáo xứ nhỏ — tối đa 5 lớp', 1500000, 1),
  (2, 'Giáo xứ vừa — 6 đến 12 lớp', 2900000, 2),
  (3, 'Giáo xứ lớn — 13 đến 20 lớp', 5200000, 3),
  (4, 'Giáo xứ rất lớn — trên 20 lớp', null,   4)
on conflict (id) do nothing;

-- 2) Mã giảm giá. Đọc qua RPC get_discount (không lộ cả bảng), ghi qua service_role.
create table if not exists public.discount_codes (
  code        text primary key,
  kind        text not null default 'percent',   -- 'percent' | 'amount'
  value       bigint not null default 0,          -- % hoặc số tiền
  expires_at  date,
  max_uses    int,                                -- null = không giới hạn
  used_count  int not null default 0,
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.discount_codes enable row level security;  -- không policy => chỉ RPC/service_role

-- 3) Đơn chờ thanh toán. Không policy => giáo xứ tạo qua RPC (security definer),
--    super-admin đọc/cập nhật qua admin-api (service_role).
create table if not exists public.plan_orders (
  id              uuid primary key default gen_random_uuid(),
  order_code      text unique not null,
  parish_id       uuid references public.parishes(id) on delete set null,
  tier_id         int,
  tier_label      text,
  base_amount     bigint not null default 0,
  discount_code   text,
  discount_amount bigint not null default 0,
  final_amount    bigint not null default 0,
  status          text not null default 'pending',  -- pending | paid | canceled
  created_at      timestamptz not null default now()
);
alter table public.plan_orders enable row level security;  -- không policy

-- RPC: kiểm mã giảm giá (cho giáo xứ xem giá sau giảm khi nhập mã)
create or replace function public.get_discount(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.discount_codes;
begin
  select * into d from public.discount_codes
    where upper(code) = upper(p_code) and active
      and (expires_at is null or expires_at >= current_date)
      and (max_uses is null or used_count < max_uses)
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('code', d.code, 'kind', d.kind, 'value', d.value);
end $$;
grant execute on function public.get_discount(text) to anon, authenticated;

-- RPC: tạo đơn chờ (server tự tính tiền + validate mã) -> trả mã đơn & số tiền cho QR
create or replace function public.create_plan_order(p_tier_id int, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_parish uuid;
  v_tier public.plan_tiers;
  v_code public.discount_codes;
  v_base bigint; v_discount bigint := 0; v_final bigint; v_used text := null; v_order text;
begin
  select parish_id into v_parish from public.profiles where id = auth.uid();
  if v_parish is null then return jsonb_build_object('error', 'Không xác định giáo xứ'); end if;

  select * into v_tier from public.plan_tiers where id = p_tier_id and active;
  if not found then return jsonb_build_object('error', 'Gói không hợp lệ'); end if;
  if v_tier.price is null then return jsonb_build_object('contact', true, 'tier_label', v_tier.label); end if;

  v_base := v_tier.price;
  if p_code is not null and length(trim(p_code)) > 0 then
    select * into v_code from public.discount_codes
      where upper(code) = upper(p_code) and active
        and (expires_at is null or expires_at >= current_date)
        and (max_uses is null or used_count < max_uses)
      limit 1;
    if found then
      if v_code.kind = 'percent' then v_discount := floor(v_base * v_code.value / 100.0);
      else v_discount := least(v_code.value, v_base); end if;
      v_used := v_code.code;
    end if;
  end if;
  v_final := greatest(v_base - v_discount, 0);
  v_order := 'GL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.plan_orders (order_code, parish_id, tier_id, tier_label, base_amount, discount_code, discount_amount, final_amount)
  values (v_order, v_parish, v_tier.id, v_tier.label, v_base, v_used, v_discount, v_final);

  return jsonb_build_object(
    'order_code', v_order, 'tier_label', v_tier.label,
    'base_amount', v_base, 'discount_code', v_used,
    'discount_amount', v_discount, 'final_amount', v_final);
end $$;
grant execute on function public.create_plan_order(int, text) to authenticated;
