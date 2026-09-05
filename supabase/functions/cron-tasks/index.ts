// Edge Function chạy theo lịch (pg_cron gọi hằng ngày): nhắc gia hạn Pro trước
// 10 ngày hết hạn. Bảo vệ bằng header x-cron-secret == CRON_SECRET.
// Deploy: npx supabase functions deploy cron-tasks --no-verify-jwt --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Encode tiêu đề UTF-8 -> RFC 2047 base64 encoded-words (ASCII hợp lệ).
function mimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s) && !s.includes('=?')) return s;
  const enc = new TextEncoder(); const words: string[] = []; let buf: number[] = [];
  const flush = () => { if (buf.length) { words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...buf))}?=`); buf = []; } };
  for (const ch of s) { const b = Array.from(enc.encode(ch)); if (buf.length + b.length > 39) flush(); buf.push(...b); }
  flush(); return words.join('\r\n ');
}

// Gửi email HTML qua SMTP thô (Deno TLS) — không dùng denomailer (dựng MIME hỏng -> Gmail hiện raw).
async function sendGmail(to: string, subject: string, html: string, _text: string) {
  const user = Deno.env.get('GMAIL_USER'); const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) return false;
  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
  const E = new TextEncoder(), D = new TextDecoder();
  const read = async (): Promise<string> => {
    const b = new Uint8Array(8192); let out = '';
    while (true) { const n = await conn.read(b); if (n === null) break; out += D.decode(b.subarray(0, n));
      const last = out.trimEnd().split(/\r?\n/).pop() || ''; if (/^\d{3} /.test(last)) break; }
    return out;
  };
  const cmd = async (s: string) => { await conn.write(E.encode(s + '\r\n')); return await read(); };
  const b64 = (s: string) => { const by = E.encode(s); let bin = ''; for (const x of by) bin += String.fromCharCode(x); return btoa(bin); };
  const b64wrap = (s: string) => (b64(s).match(/.{1,76}/g) || []).join('\r\n');
  try {
    await read(); await cmd('EHLO giaoly'); await cmd('AUTH LOGIN'); await cmd(b64(user));
    const rp = await cmd(b64(pass)); if (!/^235/.test(rp.trimStart())) throw new Error('AUTH: ' + rp);
    await cmd(`MAIL FROM:<${user}>`); await cmd(`RCPT TO:<${to}>`);
    const rd = await cmd('DATA'); if (!/^354/.test(rd.trimStart())) throw new Error('DATA: ' + rd);
    const headers = [`From: Giao Ly So <${user}>`, `To: <${to}>`, `Subject: ${mimeWord(subject)}`,
      `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, `Content-Transfer-Encoding: base64`].join('\r\n');
    await conn.write(E.encode(headers + '\r\n\r\n' + b64wrap(html) + '\r\n.\r\n'));
    const fin = await read(); if (!/^250/.test(fin.trimStart())) throw new Error('SEND: ' + fin);
    await cmd('QUIT');
  } finally { try { conn.close(); } catch (_e) { /* ignore */ } }
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
        <p style="margin:0 0 14px">Gói <b>Pro</b> của giáo xứ <b>${pname}</b> sẽ hết hạn vào <b>${dateStr}</b>, còn <b>${days} ngày</b>.</p>
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

function expiredHtml(pname: string, who: string, expStr: string, purgeStr: string, daysToPurge: number, appUrl: string, gmailUser: string) {
  return `
  <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#b91c1c;padding:20px 28px;text-align:center">
        <img src="${appUrl}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
      </div>
      <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
        <h2 style="color:#b91c1c;margin:0 0 12px;font-size:20px">Gói Pro đã hết hạn, nguy cơ mất dữ liệu ⚠️</h2>
        <p style="margin:0 0 12px">Kính gửi ${who},</p>
        <p style="margin:0 0 14px">Gói <b>Pro</b> của giáo xứ <b>${pname}</b> đã hết hạn vào <b>${expStr}</b>. Ứng dụng đang tạm khóa cho tới khi gia hạn.</p>
        <p style="margin:0 0 14px;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b">
          Để bảo đảm an toàn, dữ liệu của giáo xứ sẽ được <b>xóa sau 30 ngày</b> kể từ ngày hết hạn, dự kiến từ <b>${purgeStr}</b> (còn <b>${daysToPurge} ngày</b>). Xin gia hạn hoặc liên hệ hỗ trợ để sao lưu dữ liệu trước thời hạn.
        </p>
        <p style="text-align:center;margin:0"><a href="${appUrl}" style="background:#b91c1c;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Gia hạn ngay</a></p>
      </div>
      <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
        Cần hỗ trợ hoặc sao lưu dữ liệu, xin phản hồi email này.<br>
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
  const from = new Date(now.getTime() - 30 * 86400000);   // đã hết hạn tối đa 30 ngày (còn trong hạn xóa)
  const to30 = new Date(now.getTime() + 30 * 86400000);   // sắp hết hạn trong 30 ngày

  // Giáo xứ Pro trong cửa sổ nhắc: 30 ngày trước hạn -> 30 ngày sau hạn.
  const { data: parishes } = await admin.from('parishes')
    .select('id, name, plan, plan_expires_at, settings')
    .eq('plan', 'pro').not('plan_expires_at', 'is', null)
    .gte('plan_expires_at', from.toISOString()).lte('plan_expires_at', to30.toISOString());

  let sent = 0;
  for (const p of (parishes || [])) {
    // Nhịp 3 ngày/lần: bỏ qua nếu đã nhắc trong vòng 3 ngày.
    const last = p.settings?.renew_last_reminded ? new Date(p.settings.renew_last_reminded) : null;
    if (last && (now.getTime() - last.getTime()) < 3 * 86400000) continue;

    const { data: prof } = await admin.from('profiles').select('id, full_name').eq('parish_id', p.id).eq('role', 'admin').limit(1).maybeSingle();
    if (!prof) continue;
    const { data: uu } = await admin.auth.admin.getUserById(prof.id);
    const to = uu?.user?.email;
    if (!to) continue;
    const who = prof.full_name || 'Quý Cha / Quý Thầy Cô';
    const exp = new Date(p.plan_expires_at);
    const expStr = exp.toLocaleDateString('vi-VN');
    const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    try {
      if (days > 0) {
        await sendGmail(to, `Gói Pro sắp hết hạn (còn ${days} ngày): ${p.name}`,
          reminderHtml(p.name || 'Giáo xứ', who, expStr, days, appUrl, gmailUser),
          `Gói Pro của ${p.name} sẽ hết hạn ngày ${expStr} (còn ${days} ngày). Xin gia hạn để không gián đoạn.`);
      } else {
        const daysToPurge = Math.max(0, 30 + days); // days <= 0
        const purgeStr = new Date(exp.getTime() + 30 * 86400000).toLocaleDateString('vi-VN');
        await sendGmail(to, `Gói Pro đã hết hạn, dữ liệu sẽ bị xóa sau ${daysToPurge} ngày: ${p.name}`,
          expiredHtml(p.name || 'Giáo xứ', who, expStr, purgeStr, daysToPurge, appUrl, gmailUser),
          `Gói Pro của ${p.name} đã hết hạn ngày ${expStr}. Dữ liệu sẽ bị xóa sau ${daysToPurge} ngày. Xin gia hạn hoặc sao lưu.`);
      }
      await admin.from('parishes').update({ settings: { ...(p.settings || {}), renew_last_reminded: now.toISOString() } }).eq('id', p.id);
      sent++;
    } catch (_e) { /* bỏ qua giáo xứ lỗi, tiếp tục */ }
  }
  return new Response(JSON.stringify({ ok: true, checked: parishes?.length || 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
