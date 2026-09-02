-- Lưu "vùng nội dung" (inset) đã căn cho từng khung chứng chỉ tùy chỉnh.
-- inset = {"top":.., "right":.., "bottom":.., "left":..} tính theo % của tờ.
-- Admin căn 1 lần cho mỗi khung -> mọi GLV in ra khớp ô trống của khung.
alter table public.cert_frames add column if not exists inset jsonb;
