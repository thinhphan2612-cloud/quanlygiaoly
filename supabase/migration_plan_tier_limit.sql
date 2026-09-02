-- =====================================================================
--  GIỚI HẠN SỐ LỚP theo mức gói Pro (nhỏ ≤5 / vừa ≤12 / lớn = không giới hạn).
--  - parishes.plan_max_classes: số lớp tối đa (null = không giới hạn).
--  - plan_tiers.max_classes: giới hạn của từng mức (để đơn hàng suy ra).
--  - Trigger chặn tạo lớp vượt giới hạn (enforce phía DB, không lách được).
--  Chạy 1 lần trong SQL Editor. Sau đó redeploy Edge Function admin-api.
-- =====================================================================

alter table public.parishes  add column if not exists plan_max_classes int;
alter table public.plan_tiers add column if not exists max_classes int;

-- Nhỏ = 5, vừa = 12, lớn = 20, rất lớn (trên 20) = liên hệ / không giới hạn (null).
update public.plan_tiers set max_classes = 5    where id = 1;
update public.plan_tiers set max_classes = 12   where id = 2;
update public.plan_tiers set max_classes = 20   where id = 3;
update public.plan_tiers set max_classes = null where id = 4;

-- Chặn tạo lớp vượt mức (free = 1 lớp; pro = plan_max_classes; null = vô hạn).
-- Chỉ tính lớp đang hoạt động (chưa tốt nghiệp/lưu trữ).
create or replace function public.enforce_class_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text; v_max int; v_cnt int;
begin
  select plan, plan_max_classes into v_plan, v_max from public.parishes where id = new.parish_id;
  if v_plan = 'free' then v_max := 1; end if;
  if v_max is null then return new; end if;                 -- không giới hạn
  select count(*) into v_cnt from public.classes
    where parish_id = new.parish_id and coalesce(graduated, false) = false;
  if v_cnt >= v_max then
    raise exception 'Đã đạt tối đa % lớp của gói hiện tại. Nâng mức gói để thêm lớp.', v_max;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_class_limit on public.classes;
create trigger trg_enforce_class_limit before insert on public.classes
  for each row execute function public.enforce_class_limit();
