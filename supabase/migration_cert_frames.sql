-- Khung chứng chỉ TÙY CHỈNH theo giáo xứ: admin tải khung (ảnh) lên -> mọi GLV áp dụng.
create table if not exists public.cert_frames (
  id         uuid primary key default gen_random_uuid(),
  parish_id  uuid not null references public.parishes(id) on delete cascade,
  type       text not null,            -- baptism | marriage | scout
  name       text not null,
  url        text not null,            -- public URL trong Storage bucket 'cert-frames'
  created_at timestamptz default now()
);
create index if not exists idx_cert_frames_parish on public.cert_frames(parish_id);

alter table public.cert_frames enable row level security;
-- Đọc: mọi thành viên giáo xứ. Ghi (thêm/xoá): chỉ ADMIN của giáo xứ.
drop policy if exists cf_select on public.cert_frames;
create policy cf_select on public.cert_frames for select using (parish_id = public.current_parish_id());
drop policy if exists cf_write on public.cert_frames;
create policy cf_write on public.cert_frames for all
  using (parish_id = public.current_parish_id() and public.is_admin())
  with check (parish_id = public.current_parish_id() and public.is_admin());

-- ---- Storage: bucket công khai cho ảnh khung; chỉ admin ghi ----
insert into storage.buckets (id, name, public)
values ('cert-frames', 'cert-frames', true)
on conflict (id) do nothing;

drop policy if exists cf_obj_read on storage.objects;
create policy cf_obj_read on storage.objects for select using (bucket_id = 'cert-frames');
drop policy if exists cf_obj_insert on storage.objects;
create policy cf_obj_insert on storage.objects for insert with check (bucket_id = 'cert-frames' and public.is_admin());
drop policy if exists cf_obj_delete on storage.objects;
create policy cf_obj_delete on storage.objects for delete using (bucket_id = 'cert-frames' and public.is_admin());
