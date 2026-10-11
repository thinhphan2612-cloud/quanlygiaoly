-- =====================================================================
--  Tính năng theo giáo xứ cho Ephata Store (an toàn chạy lại, KHÔNG có dữ liệu demo).
--  Chạy trong SQL Editor của project Giáo Lý Số (ref jznntxlixctjwxqxatxs).
--  Nếu trước đây đã chạy migration_entitlements.sql thì file này chỉ bổ sung những gì còn thiếu.
-- =====================================================================

create table if not exists public.features (
  key         text primary key,
  name        text not null,
  description text,
  category    text,
  kind        text not null default 'builtin',
  config      jsonb not null default '{}'::jsonb,
  price       text,
  active      boolean not null default true,
  order_index int not null default 0
);
alter table public.features enable row level security;
drop policy if exists features_read on public.features;
create policy features_read on public.features for select using (true);

create table if not exists public.parish_features (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  status      text not null default 'active',  -- active | expired | revoked
  source      text not null default 'manual',  -- purchase | trial | bundle | manual
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (parish_id, feature_key)
);
alter table public.parish_features enable row level security;
drop policy if exists pf_read on public.parish_features;
create policy pf_read on public.parish_features for select
  using (parish_id = public.current_parish_id());
create index if not exists idx_pf_parish on public.parish_features(parish_id);

-- Kiểm tra (chạy riêng nếu muốn): dữ liệu DEMO của migration_entitlements.sql cũ đã cấp 'certificate'
-- (source='trial') cho MỌI giáo xứ. Nếu không chủ ý, xóa bằng:
--   delete from public.parish_features where feature_key = 'certificate' and source = 'trial';
