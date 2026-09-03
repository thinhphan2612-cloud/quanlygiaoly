// Edge Function chạy theo lịch (pg_cron gọi hằng ngày): nhắc gia hạn Pro trước
// 10 ngày hết hạn. Bảo vệ bằng header x-cron-secret == CRON_SECRET.
// Deploy: npx supabase functions deploy cron-tasks --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

async function sendGmail(to: string, subject: string, html: string, text: string) {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) return false;
  const client = new SMTPClient({
    connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: user, password: pass } },
  });
  await client.send({ from: `Giáo Lý Số <${user}>`, to, subject, content: text, html });
  await client.close();
  return true;
}

function reminderHtml(pname: string, who: string, dateStr: string, days: number, appUrl: string, gmailUser: string) {
  return `
  <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#2563eb;padding:20px 28px;text-align:center">
        <img src="${appUrl}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
      </div>
      <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
        <h2 style="color:#b45309;margin:0 0 12px;font-size:20px">Gói Pro sắp hết hạn ⏰</h2>
        <p style="margin:0 0 12px">Kính gửi ${who},</p>
        <p style="margin:0 0 14px">Gói <b>Pro</b> của giáo xứ <b>${pname}</b> sẽ hết hạn vào <b>${dateStr}</b> — còn <b>${days} ngày</b>.</p>
        <p style="margin:0 0 20px">Để không gián đoạn các tính năng Pro (chứng chỉ, thi online, điểm số &amp; thi đua, lưu trữ niên khóa…), xin gia hạn trước khi hết hạn. Vào ứng dụng mục <b>Xem gói &amp; nâng cấp</b> hoặc liên hệ để được hỗ trợ.</p>
        <p style="text-align:center;margin:0"><a href="${appUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Gia hạn ngay</a></p>
      </div>
      <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
        Cần hỗ trợ, xin phản hồi email này.<br>
        <b style="color:#374151">Giáo Lý Số</b> · ${gmailUser}
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const appUrl = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';
  const gmailUser = Deno.env.get('GMAIL_USER') || '';
  const now = new Date();
  const in10 = new Date(now.getTime() + 10 * 86400000);

  // Giáo xứ Pro sắp hết hạn trong 10 ngày (và chưa qua hạn).
  const { data: parishes } = await admin.from('parishes')
    .select('id, name, plan, plan_expires_at, settings')
    .eq('plan', 'pro').not('plan_expires_at', 'is', null)
    .gte('plan_expires_at', now.toISOString()).lte('plan_expires_at', in10.toISOString());

  let sent = 0;
  for (const p of (parishes || [])) {
    if (p.settings?.renew_reminded_for === p.plan_expires_at) continue; // đã nhắc cho hạn này
    const { data: prof } = await admin.from('profiles').select('id, full_name').eq('parish_id', p.id).eq('role', 'admin').limit(1).maybeSingle();
    if (!prof) continue;
    const { data: uu } = await admin.auth.admin.getUserById(prof.id);
    const to = uu?.user?.email;
    if (!to) continue;
    const who = prof.full_name || 'Quý Cha / Quý Thầy Cô';
    const dateStr = new Date(p.plan_expires_at).toLocaleDateString('vi-VN');
    const days = Math.max(0, Math.ceil((new Date(p.plan_expires_at).getTime() - now.getTime()) / 86400000));
    try {
      await sendGmail(to, `Gói Pro sắp hết hạn (còn ${days} ngày) — ${p.name}`,
        reminderHtml(p.name || 'Giáo xứ', who, dateStr, days, appUrl, gmailUser),
        `Gói Pro của ${p.name} sẽ hết hạn ngày ${dateStr} (còn ${days} ngày). Xin gia hạn để không gián đoạn.`);
      await admin.from('parishes').update({ settings: { ...(p.settings || {}), renew_reminded_for: p.plan_expires_at } }).eq('id', p.id);
      sent++;
    } catch (_e) { /* bỏ qua giáo xứ lỗi, tiếp tục */ }
  }
  return new Response(JSON.stringify({ ok: true, checked: parishes?.length || 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
