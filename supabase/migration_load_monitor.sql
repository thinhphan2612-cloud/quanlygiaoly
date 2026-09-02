-- =====================================================================
--  GIÁM SÁT TẢI (super-admin): đo số học viên đang thi đồng thời -> báo
--  sớm trước khi hạ tầng ngộp. Gồm:
--   1) load_stats()      : RPC cho đèn báo (chỉ super-admin gọi).
--   2) exam_load_guard() : chạy nền (pg_cron) -> vượt ngưỡng thì tự tạo
--      thông báo cho super-admin, kể cả khi không ai mở trang.
--  Chạy 1 lần trong Supabase → SQL Editor.
-- =====================================================================

-- Chỉ số tải hiện tại. "taking" = em đang trong đề ĐÃ bắt đầu (poll nặng nhất).
create or replace function public.load_stats()
returns json language plpgsql security definer set search_path = public stable as $$
declare v_taking int; v_waiting int; v_open int;
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  select count(*) into v_taking
    from exam_attempts a join exams e on e.id = a.exam_id
    where a.status = 'joined' and e.status = 'started';
  select count(*) into v_waiting
    from exam_attempts a join exams e on e.id = a.exam_id
    where a.status = 'joined' and e.status = 'waiting';
  select count(*) into v_open from exams where status in ('waiting','started');
  return json_build_object(
    'taking', v_taking, 'waiting', v_waiting, 'open_exams', v_open,
    'ts', extract(epoch from now())
  );
end $$;
grant execute on function public.load_stats() to authenticated;

-- Ngưỡng ĐỎ cho cảnh báo nền (theo số em đang thi). ĐỔI 1 SỐ NÀY theo compute
-- bạn đang dùng (Micro ~400, Small ~700, Medium+ ~1200...).
create or replace function public.exam_load_guard()
returns void language plpgsql security definer set search_path = public as $$
declare v_taking int; v_red int := 600; v_msg text;
begin
  select count(*) into v_taking
    from exam_attempts a join exams e on e.id = a.exam_id
    where a.status = 'joined' and e.status = 'started';
  if v_taking < v_red then return; end if;
  v_msg := 'Có ' || v_taking || ' học viên đang thi đồng thời (ngưỡng ' || v_red
        || '). Cân nhắc nâng compute Supabase trước khi hệ thống chậm.';
  -- Gửi cho mọi tài khoản super-admin, chống trùng: tối đa 1 cảnh báo / 10 phút.
  insert into notifications (parish_id, recipient_id, title, content, type)
  select p.parish_id, p.id, 'Cảnh báo tải hệ thống', v_msg, 'system'
  from profiles p join auth.users u on u.id = p.id
  where lower(u.email) in ('support.giaolyso@gmail.com')
    and not exists (
      select 1 from notifications n
      where n.recipient_id = p.id and n.type = 'system'
        and n.created_at > now() - interval '10 minutes'
    );
end $$;

-- Lịch chạy nền mỗi phút. Cần extension pg_cron (bật ở Dashboard → Database →
-- Extensions nếu khối dưới báo lỗi). Nếu không bật được, load_stats + đèn báo
-- vẫn hoạt động; chỉ mất phần "tự gửi khi không mở trang".
do $$
begin
  create extension if not exists pg_cron;
  begin perform cron.unschedule('exam-load-guard'); exception when others then null; end;
  perform cron.schedule('exam-load-guard', '* * * * *', 'select public.exam_load_guard();');
exception when others then
  raise notice 'pg_cron chưa sẵn sàng — bật extension rồi chạy lại phần cron. Phần còn lại đã cài xong.';
end $$;
