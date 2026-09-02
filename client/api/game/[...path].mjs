// Proxy file game từ Supabase Storage (bucket default-games) và trả về với ĐÚNG
// Content-Type theo đuôi file. Cần thiết vì Supabase Storage ép mọi .html thành
// text/plain + nosniff (chặn host HTML) -> game nhiều trang không chạy khi mở
// thẳng. Proxy này cùng origin với app nên mọi trang/asset của game render đúng,
// điều hướng nội bộ (vd admin.html) hoạt động, và không dính CORS.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://jznntxlixctjwxqxatxs.supabase.co';

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', txt: 'text/plain; charset=utf-8',
};
const mimeOf = (p) => MIME[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

export default async function handler(req, res) {
  const parts = req.query.path;
  const rel = (Array.isArray(parts) ? parts : [parts]).filter(Boolean).join('/');
  if (!rel || rel.includes('..')) { res.status(400).send('Bad path'); return; }
  const url = `${SUPABASE_URL}/storage/v1/object/public/default-games/${rel}`;
  try {
    const r = await fetch(url, req.headers.range ? { headers: { range: req.headers.range } } : undefined);
    if (!r.ok && r.status !== 206) { res.status(r.status).send('Not found'); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', mimeOf(rel));
    res.setHeader('Cache-Control', 'public, max-age=300');
    const cr = r.headers.get('content-range'); if (cr) res.setHeader('Content-Range', cr);
    const ar = r.headers.get('accept-ranges'); if (ar) res.setHeader('Accept-Ranges', ar);
    res.status(r.status === 206 ? 206 : 200).send(buf);
  } catch (e) {
    res.status(502).send('Proxy error');
  }
}
