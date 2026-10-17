-- Vá policy tạo thông báo (chạy TAY trong Supabase SQL Editor).
--
-- Lỗ: notif_insert chỉ kiểm parish_id = giáo xứ của người gửi, KHÔNG kiểm người nhận và người gửi.
--  * Tài khoản giáo xứ A gọi API trực tiếp chèn được thông báo vào chuông người dùng giáo xứ B
--    (người nhận vẫn thấy vì policy đọc là recipient_id = auth.uid()) -> đường lừa đảo xuyên giáo xứ.
--  * Giáo lý viên gửi được thông báo giả danh quản trị viên (sender_id tự đặt).
--
-- Sau khi chạy:
--  * Chỉ quản trị viên được gửi, sender_id phải là chính mình, người nhận phải cùng giáo xứ.
--  * Cảnh báo tải hệ thống (exam_load_guard, security definer) và Edge Functions dùng service_role
--    không bị ảnh hưởng.

drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert
  with check (
    parish_id = public.current_parish_id()
    and public.is_admin()
    and sender_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.parish_id = public.current_parish_id()
    )
  );
