// Gửi email CHÀO MỪNG gói Pro khi user TỰ NHẬP MÃ (redeem_pro_code) kích hoạt Pro.
// Xác thực bằng JWT của chính user (parish admin). Best-effort: lỗi email không chặn.
// Deploy: npx supabase functions deploy redeem-welcome --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Encode tiêu đề UTF-8 -> RFC 2047 base64 encoded-words (ASCII hợp lệ).
function mimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s) && !s.includes('=?')) return s;
  const enc = new TextEncoder(); const words: string[] = []; let buf: number[] = [];
  const flush = () => { if (buf.length) { words.push(`=?UTF-8?B?${btoa(String.fromCharCode(...buf))}?=`); buf = []; } };
  for (const ch of s) { const b = Array.from(enc.encode(ch)); if (buf.length + b.length > 39) flush(); buf.push(...b); }
  flush(); return words.join('\r\n ');
}
// Gửi email HTML qua SMTP thô (Deno TLS) — không dùng denomailer (dựng MIME hỏng).
async function smtpSend(to: string, subject: string, html: string) {
  const user = Deno.env.get('GMAIL_USER')!; const pass = Deno.env.get('GMAIL_APP_PASSWORD')!;
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
}

function welcomeHtml(who: string, pname: string, maxClasses: number | null, expires: string | null, gmailUser: string, appUrl: string) {
  const limitTxt = maxClasses ? `tối đa <b>${maxClasses} lớp</b>` : '<b>không giới hạn lớp</b>';
  const expTxt = expires ? `đến hết ngày <b>${new Date(expires).toLocaleDateString('vi-VN')}</b>` : '<b>không giới hạn thời gian</b>';
  return `
    <div style="background:#f4f6fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
        <div style="background:#2563eb;padding:20px 28px;text-align:center">
          <img src="${appUrl}/logo-full.png" alt="Giáo Lý Số" height="38" style="height:38px;display:inline-block" />
        </div>
        <div style="padding:26px 30px;color:#1f2937;line-height:1.6">
          <h2 style="color:#2563eb;margin:0 0 12px;font-size:20px">Chào mừng ${pname} lên gói Pro! 🎉</h2>
          <p style="margin:0 0 12px">Kính gửi ${who},</p>
          <p style="margin:0 0 14px">Giáo xứ <b>${pname}</b> đã kích hoạt thành công <b>gói Pro</b> trên Giáo Lý Số bằng mã ưu đãi:</p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px">
            <tr><td style="padding:8px 0;color:#6b7280">Quy mô</td><td style="padding:8px 0;text-align:right">${limitTxt}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #eef2f7">Hiệu lực</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eef2f7">${expTxt}</td></tr>
          </table>
          <p style="margin:0 0 20px">Toàn bộ tính năng Pro đã mở khóa: không giới hạn giáo lý viên, xuất chứng chỉ, thi online, điểm số &amp; thi đua, lưu trữ niên khóa, game học giáo lý…</p>
          <p style="text-align:center;margin:0"><a href="${appUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Vào ứng dụng</a></p>
        </div>
        <div style="padding:18px 30px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12.5px;line-height:1.6">
          Xin Chúa chúc lành cho việc dạy giáo lý của giáo xứ. Cần hỗ trợ, xin phản hồi email này.<br>
          <b style="color:#374151">Giáo Lý Số</b> · ${gmailUser}
        </div>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!jwt) return json({ ok: false, error: 'no-auth' }, 401);
    const gmailUser = Deno.env.get('GMAIL_USER'); const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailUser || !gmailPass) return json({ ok: false, error: 'no-smtp' });
    const appUrl = Deno.env.get('APP_URL') || 'https://app.giaoly.com.vn';
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ ok: false, error: 'invalid-user' }, 401);
    const to = user.email;
    if (!to) return json({ ok: false, error: 'no-email' });

    const { data: prof } = await admin.from('profiles').select('parish_id, full_name, role').eq('id', user.id).maybeSingle();
    if (!prof?.parish_id) return json({ ok: false, error: 'no-parish' });
    const { data: par } = await admin.from('parishes').select('name, plan, plan_expires_at, plan_max_classes').eq('id', prof.parish_id).maybeSingle();
    if (!par || par.plan !== 'pro') return json({ ok: false, error: 'not-pro' }); // chỉ gửi khi đã lên Pro

    await smtpSend(to, `Chào mừng ${par.name || 'giáo xứ'} lên gói Pro`,
      welcomeHtml(prof.full_name || 'Quý Cha / Quý Thầy Cô', par.name || 'Giáo xứ', par.plan_max_classes ?? null, par.plan_expires_at ?? null, gmailUser, appUrl));
    return json({ ok: true, sent_to: to });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
});
