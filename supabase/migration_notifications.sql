-- =====================================================================
--  THÔNG BÁO (admin→GV) + CHUÔNG BÁO VẮNG — bảng notifications
--  Chạy 1 lần trong Supabase → SQL Editor.
-- =====================================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  parish_id    uuid not null references public.parishes(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id    uuid references public.profiles(id) on delete set null,
  title        text,
  content      text not null,
  type         text not null default 'admin',   -- 'admin' | 'absence'
  student_id   uuid references public.students(id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Người nhận xem thông báo của mình; admin xem mọi thông báo trong giáo xứ
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select
  using (recipient_id = auth.uid() or (public.is_admin() and parish_id = public.current_parish_id()));

-- Thành viên trong giáo xứ được tạo thông báo (admin gửi, hoặc hệ thống báo vắng)
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert
  with check (parish_id = public.current_parish_id());

-- Người nhận đánh dấu đã đọc thông báo của mình
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete
  using (recipient_id = auth.uid() or (public.is_admin() and parish_id = public.current_parish_id()));

create index if not exists idx_notif_recipient on public.notifications(recipient_id, read);
create index if not exists idx_notif_parish on public.notifications(parish_id);
