-- =====================================================================
--  Gia hạn CỘNG DỒN cho mã Pro miễn phí: nếu còn hạn ở tương lai thì cộng
--  thêm số tháng vào hạn hiện tại (không reset về hôm nay). Đổi mức lớp vẫn
--  giữ nguyên thời gian đã có. Xóa cờ nhắc gia hạn để chu kỳ nhắc reset.
-- =====================================================================
create or replace function public.redeem_pro_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.discount_codes; v_pid uuid; v_max int; v_label text; v_exp timestamptz; v_months int;
  v_plan text; v_cur timestamptz; v_base timestamptz; v_settings jsonb;
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

  -- Cộng dồn: mốc = hạn hiện tại nếu đang Pro và còn hạn, ngược lại = bây giờ.
  select plan, plan_expires_at, coalesce(settings, '{}'::jsonb) into v_plan, v_cur, v_settings
    from public.parishes where id = v_pid;
  v_base := case when v_plan = 'pro' and v_cur is not null and v_cur > now() then v_cur else now() end;
  v_exp := v_base + make_interval(months => v_months);
  v_settings := v_settings - 'renew_last_reminded' - 'renew_reminded_for';

  update public.parishes
    set plan = 'pro', plan_expires_at = v_exp, plan_max_classes = v_max, settings = v_settings
    where id = v_pid;
  update public.discount_codes set used_count = used_count + 1 where code = c.code;
  return jsonb_build_object('ok', true, 'months', v_months, 'max_classes', v_max, 'tier_label', v_label, 'expires_at', v_exp);
end $$;
grant execute on function public.redeem_pro_code(text) to authenticated;
