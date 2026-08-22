-- =====================================================================
--  THU CHI THEO LỚP: GLV ghi thu chi lớp mình; admin xem tất cả + quản lý
--  khoản chung (class_id null); admin KHÔNG sửa khoản của lớp.
--  Chạy 1 lần trong SQL Editor.
-- =====================================================================
drop policy if exists tenant_rw on public.transactions;
drop policy if exists tx_admin on public.transactions;
drop policy if exists tx_teacher on public.transactions;
drop policy if exists tx_admin_sel on public.transactions;
drop policy if exists tx_admin_general on public.transactions;

-- GLV: toàn quyền trên khoản thu chi thuộc lớp mình phụ trách
create policy tx_teacher on public.transactions for all
  using (parish_id = public.current_parish_id() and public.teaches_class(class_id))
  with check (parish_id = public.current_parish_id() and public.teaches_class(class_id));

-- Admin: XEM tất cả thu chi trong giáo xứ
create policy tx_admin_sel on public.transactions for select
  using (parish_id = public.current_parish_id() and public.is_admin());

-- Admin: quản lý khoản CHUNG (không thuộc lớp nào)
create policy tx_admin_general on public.transactions for all
  using (parish_id = public.current_parish_id() and public.is_admin() and class_id is null)
  with check (parish_id = public.current_parish_id() and public.is_admin() and class_id is null);
