-- =====================================================================
--  Lịch nhắc gia hạn Pro: mỗi ngày gọi Edge Function 'cron-tasks' để gửi
--  email nhắc các giáo xứ Pro sắp hết hạn (trong 10 ngày).
--  TRƯỚC KHI CHẠY: thay <CRON_SECRET> bằng giá trị bạn đặt cho secret
--  CRON_SECRET của function (phải trùng nhau).
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin perform cron.unschedule('renew-reminder'); exception when others then null; end $$;

-- 01:00 UTC ~ 08:00 giờ VN, mỗi ngày.
select cron.schedule('renew-reminder', '0 1 * * *', $job$
  select net.http_post(
    url := 'https://jznntxlixctjwxqxatxs.supabase.co/functions/v1/cron-tasks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := jsonb_build_object('task', 'renew-reminder')
  );
$job$);
