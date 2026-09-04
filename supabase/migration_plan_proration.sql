-- =====================================================================
--  ĐỔI GÓI KIỂU APPLE: chu kỳ 365 ngày mới tính từ hôm nay, khấu trừ bằng
--  TIỀN phần còn thừa của gói hiện tại (credit) vào số phải trả. Không cộng
--  dồn thời gian nữa. Hạn mới do order-paid đặt = now() + 12 tháng.
-- =====================================================================
alter table public.plan_orders add column if not exists credit_amount bigint not null default 0;

create or replace function public.create_plan_order(p_tier_id int, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_parish uuid;
  v_tier public.plan_tiers;
  v_code public.discount_codes;
  v_base bigint; v_discount bigint := 0; v_final bigint; v_used text := null; v_order text;
  v_cur_plan text; v_cur_exp timestamptz; v_cur_max int; v_cur_price bigint; v_credit bigint := 0; v_days numeric;
begin
  select parish_id into v_parish from public.profiles where id = auth.uid();
  if v_parish is null then return jsonb_build_object('error', 'Không xác định giáo xứ'); end if;

  select * into v_tier from public.plan_tiers where id = p_tier_id and active;
  if not found then return jsonb_build_object('error', 'Gói không hợp lệ'); end if;
  if v_tier.price is null then return jsonb_build_object('contact', true, 'tier_label', v_tier.label); end if;

  v_base := v_tier.price;

  -- Mã giảm giá (percent/amount)
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

  -- Credit: nếu đang Pro còn hạn -> khấu trừ tiền phần còn thừa của gói hiện tại
  -- (giá gói hiện tại theo số lớp) × (số ngày còn lại, tối đa 365) / 365.
  select plan, plan_expires_at, plan_max_classes into v_cur_plan, v_cur_exp, v_cur_max
    from public.parishes where id = v_parish;
  if v_cur_plan = 'pro' and v_cur_exp is not null and v_cur_exp > now() then
    select price into v_cur_price from public.plan_tiers
      where max_classes is not distinct from v_cur_max and price is not null
      order by price desc limit 1;
    if v_cur_price is not null then
      v_days := least(365, extract(epoch from (v_cur_exp - now())) / 86400.0);
      v_credit := floor(v_cur_price * v_days / 365.0);
    end if;
  end if;

  v_final := greatest(v_base - v_discount - v_credit, 0);
  v_order := 'GL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.plan_orders (order_code, parish_id, tier_id, tier_label, base_amount, discount_code, discount_amount, credit_amount, final_amount)
  values (v_order, v_parish, v_tier.id, v_tier.label, v_base, v_used, v_discount, v_credit, v_final);

  return jsonb_build_object(
    'order_code', v_order, 'tier_label', v_tier.label,
    'base_amount', v_base, 'discount_code', v_used, 'discount_amount', v_discount,
    'credit_amount', v_credit, 'final_amount', v_final);
end $$;
grant execute on function public.create_plan_order(int, text) to authenticated;

-- Mã Pro miễn phí: hạn = now() + số tháng (reset từ hôm nay), nhưng KHÔNG giảm dưới
-- hạn hiện có (nếu đang Pro còn hạn xa hơn thì giữ nguyên). Không cộng dồn.
create or replace function public.redeem_pro_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.discount_codes; v_pid uuid; v_max int; v_label text; v_exp timestamptz; v_months int;
  v_plan text; v_cur timestamptz; v_settings jsonb;
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

  select plan, plan_expires_at, coalesce(settings, '{}'::jsonb) into v_plan, v_cur, v_settings
    from public.parishes where id = v_pid;
  v_exp := greatest(
    now() + make_interval(months => v_months),
    case when v_plan = 'pro' and v_cur is not null and v_cur > now() then v_cur else now() end
  );
  v_settings := v_settings - 'renew_last_reminded' - 'renew_reminded_for';

  update public.parishes
    set plan = 'pro', plan_expires_at = v_exp, plan_max_classes = v_max, settings = v_settings
    where id = v_pid;
  update public.discount_codes set used_count = used_count + 1 where code = c.code;
  return jsonb_build_object('ok', true, 'months', v_months, 'max_classes', v_max, 'tier_label', v_label, 'expires_at', v_exp);
end $$;
grant execute on function public.redeem_pro_code(text) to authenticated;
