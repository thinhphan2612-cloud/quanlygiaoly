-- =====================================================================
--  MÃ NÂNG PRO MIỄN PHÍ (kind='pro_free'): nhập mã -> kích hoạt Pro miễn phí
--  X tháng ở một MỨC (plan_tiers). Dùng cho chương trình back-to-school...
-- =====================================================================
alter table public.discount_codes add column if not exists free_months int;  -- số tháng Pro miễn phí
alter table public.discount_codes add column if not exists tier_id     int;   -- mức Pro áp dụng (plan_tiers.id)

-- get_discount: chỉ áp cho mã giảm giá (percent/amount) trong luồng thanh toán,
-- KHÔNG trả mã pro_free (mã miễn phí đi qua redeem riêng).
create or replace function public.get_discount(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.discount_codes;
begin
  select * into d from public.discount_codes
    where upper(code) = upper(p_code) and active and kind in ('percent','amount')
      and (expires_at is null or expires_at >= current_date)
      and (max_uses is null or used_count < max_uses)
    limit 1;
  if not found then return null; end if;
  return jsonb_build_object('code', d.code, 'kind', d.kind, 'value', d.value);
end $$;
grant execute on function public.get_discount(text) to anon, authenticated;

-- Số lượt còn lại của 1 mã (cho landing đếm ngược). Công khai.
create or replace function public.code_remaining(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'code', code, 'kind', kind, 'active', active,
    'max_uses', max_uses, 'used_count', used_count,
    'remaining', case when max_uses is null then null else greatest(0, max_uses - used_count) end,
    'free_months', free_months
  ) from public.discount_codes where upper(code) = upper(p_code) limit 1;
$$;
grant execute on function public.code_remaining(text) to anon, authenticated;

-- Đổi mã Pro miễn phí -> kích hoạt Pro cho giáo xứ của người gọi (chỉ admin giáo xứ).
create or replace function public.redeem_pro_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.discount_codes; v_pid uuid; v_max int; v_label text; v_exp timestamptz; v_months int;
begin
  if not public.is_admin() then raise exception 'Chỉ quản trị giáo xứ được nhập mã'; end if;
  v_pid := public.current_parish_id();
  if v_pid is null then raise exception 'Không xác định được giáo xứ'; end if;
  select * into c from public.discount_codes where upper(code) = upper(p_code) limit 1;
  if c.code is null then raise exception 'Mã không tồn tại'; end if;
  if not c.active then raise exception 'Mã đã ngừng áp dụng'; end if;
  if c.kind <> 'pro_free' then raise exception 'Mã này không phải mã nâng Pro miễn phí'; end if;
  if c.expires_at is not null and c.expires_at < current_date then raise exception 'Mã đã hết hạn'; end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then raise exception 'Mã đã hết lượt sử dụng'; end if;
  v_months := coalesce(c.free_months, 3);
  select max_classes, label into v_max, v_label from public.plan_tiers where id = c.tier_id;
  v_exp := now() + make_interval(months => v_months);
  update public.parishes set plan = 'pro', plan_expires_at = v_exp, plan_max_classes = v_max where id = v_pid;
  update public.discount_codes set used_count = used_count + 1 where code = c.code;
  return jsonb_build_object('ok', true, 'months', v_months, 'max_classes', v_max, 'tier_label', v_label, 'expires_at', v_exp);
end $$;
grant execute on function public.redeem_pro_code(text) to authenticated;

-- Tạo sẵn mã back-to-school: Pro (≤5 lớp) miễn phí 3 tháng, 50 mã, không hạn ngày.
insert into public.discount_codes (code, kind, value, free_months, tier_id, max_uses, active, note)
values ('BACKTOSCHOOL', 'pro_free', 0, 3, 1, 50, true, 'Back to school: nâng Pro (tối đa 5 lớp) miễn phí 3 tháng — 50 mã đầu tiên')
on conflict (code) do update set
  kind = excluded.kind, value = excluded.value, free_months = excluded.free_months,
  tier_id = excluded.tier_id, max_uses = excluded.max_uses, active = excluded.active, note = excluded.note;
