// Nhận tin nhắn từ form liên hệ (Zalo FAB) trên landing → gửi email về hộp hỗ trợ.
// Public (gọi bằng anon key từ trang tĩnh). Deploy:
//   npx supabase functions deploy lead-notify --no-verify-jwt --project-ref <ref>
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPPORT_TO = 'support.giaolyso@gmail.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function esc(s: string) {
  return String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
}

function notifyHtml(name: string, phone: string, msg: string, source: string) {
  return `
  <div style="background:#f4f6fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
      <div style="background:#2563eb;padding:16px 24px;color:#fff;font-weight:700;font-size:16px">📩 Tin nhắn liên hệ mới — Giáo Lý Số</div>
      <div style="padding:22px 26px;color:#1f2937;line-height:1.6">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280;width:110px">Tên</td><td style="padding:6px 0"><b>${esc(name) || '(không rõ)'}</b></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">SĐT / Email</td><td style="padding:6px 0"><b>${esc(phone) || '(không có)'}</b></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Nguồn</td><td style="padding:6px 0">${esc(source) || 'Landing'}</td></tr>
        </table>
        <div style="margin-top:14px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;white-space:pre-wrap">${esc(msg)}</div>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').slice(0, 120);
    const phone = String(body?.phone || '').slice(0, 120);
    const msg = String(body?.msg || '').slice(0, 4000).trim();
    const source = String(body?.source || 'Landing / Zalo FAB').slice(0, 120);
    if (!msg) return new Response(JSON.stringify({ ok: false, error: 'empty' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const user = Deno.env.get('GMAIL_USER');
    const pass = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!user || !pass) return new Response(JSON.stringify({ ok: false, error: 'no-smtp' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const client = new SMTPClient({
      connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: user, password: pass } },
    });
    await client.send({
      from: `Giáo Lý Số <${user}>`,
      to: SUPPORT_TO,
      replyTo: phone && /@/.test(phone) ? phone : undefined,
      subject: `[Liên hệ] ${name || 'Khách'}${phone ? ' · ' + phone : ''}`,
      content: `Tên: ${name}\nSĐT/Email: ${phone}\nNguồn: ${source}\n\n${msg}`,
      html: notifyHtml(name, phone, msg, source),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
