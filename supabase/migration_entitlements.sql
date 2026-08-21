-- =====================================================================
--  NỀN ENTITLEMENT — kho tính năng (features) + quyền theo giáo xứ
--  (parish_features). Sau này store WeCatholic ghi parish_features để
--  bật tính năng cho giáo xứ. Chạy 1 lần trong SQL Editor.
-- =====================================================================

-- Catalog tính năng (toàn hệ, không theo giáo xứ)
create table if not exists public.features (
  key         text primary key,               -- 'exam', 'certificate', 'game_pack'...
  name        text not null,
  description text,
  category    text,
  kind        text not null default 'builtin', -- builtin (chạy trong app) | hosted (nhúng/điều hướng)
  config      jsonb not null default '{}'::jsonb,
  price       text,                            -- hiển thị tham khảo
  active      boolean not null default true,
  order_index int not null default 0
);
alter table public.features enable row level security;
drop policy if exists features_read on public.features;
create policy features_read on public.features for select using (true);
-- Ghi catalog: chỉ service_role (không tạo policy cho client)

-- Quyền dùng tính năng của từng giáo xứ (entitlement)
create table if not exists public.parish_features (
  id          uuid primary key default gen_random_uuid(),
  parish_id   uuid not null references public.parishes(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  status      text not null default 'active',  -- active | expired
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
-- Ghi quyền: chỉ service_role (store / Edge Function sau khi xác nhận thanh toán)

create index if not exists idx_pf_parish on public.parish_features(parish_id);

-- Seed catalog mẫu
insert into public.features (key, name, description, category, kind, price, order_index) values
  ('exam',        'Tạo đề thi & thi online', 'Soạn đề, cho học viên thi online, tự chấm và lưu điểm.', 'Kiểm tra', 'hosted',  'Liên hệ', 1),
  ('certificate', 'Làm giấy khen',           'Sinh giấy khen / chứng nhận từ dữ liệu học viên, xuất PDF.', 'Văn bản',  'builtin', 'Liên hệ', 2),
  ('game_pack',   'Bộ game giáo lý mở rộng', 'Thêm nhiều game học giáo lý từ WeCatholic.',                 'Trò chơi', 'hosted',  'Liên hệ', 3)
on conflict (key) do nothing;

-- DEMO: cấp thử tính năng 'certificate' cho mọi giáo xứ hiện có (để test hasFeature).
-- Xóa dòng này ở production; thực tế store sẽ ghi khi giáo xứ mua.
insert into public.parish_features (parish_id, feature_key, source)
select id, 'certificate', 'trial' from public.parishes
on conflict (parish_id, feature_key) do nothing;
