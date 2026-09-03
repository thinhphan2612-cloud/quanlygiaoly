-- =====================================================================
--  FIX: create_plan_order chỉ nhận mã giảm giá 'percent'/'amount'.
--  Trước đây thiếu lọc kind -> mã 'pro_free' (vd BACKTOSCHOOL, value=0)
--  vẫn khớp, giảm 0đ nhưng bị lưu discount_code vào đơn. Nay loại hẳn.
-- =====================================================================
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
        and kind in ('percent','amount')
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
