// Service Worker: phục vụ file game (bucket default-games trên Supabase Storage)
// với ĐÚNG Content-Type. Cần vì Supabase ép mọi .html -> text/plain (chặn host
// HTML) khiến game nhiều trang không chạy. SW chạy trong chính bản build client
// nên hoạt động ở mọi nơi app được deploy, không cần serverless.
// Chỉ can thiệp các request /game-proxy/... — mọi request khác đi mạng bình thường.
const SUPA = 'https://jznntxlixctjwxqxatxs.supabase.co';
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

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/game-proxy/')) return;
  const rel = url.pathname.slice('/game-proxy/'.length);
  e.respondWith((async () => {
    try {
      // KHÔNG chuyển tiếp Range: header Content-Range của Supabase KHÔNG được lộ qua
      // CORS (thiếu Access-Control-Expose-Headers) nên response 206 dựng lại sẽ thiếu
      // Content-Range -> media hỏng. Lấy full file, trả 200 + stream; Content-Length
      // là header CORS-safelisted nên đọc được, giúp trình phát biết tổng dung lượng.
      const r = await fetch(`${SUPA}/storage/v1/object/public/default-games/${rel}`);
      const h = new Headers();
      h.set('Content-Type', mimeOf(rel));
      const cl = r.headers.get('content-length'); if (cl) h.set('Content-Length', cl);
      h.set('Cache-Control', 'public, max-age=300');
      return new Response(r.body, { status: 200, headers: h });
    } catch (err) {
      return new Response('proxy error', { status: 502 });
    }
  })());
});
