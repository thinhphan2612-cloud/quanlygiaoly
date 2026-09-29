// Service worker tối giản cho Giáo Lý Số.
// Mục đích: đủ điều kiện để trình duyệt cho phép CÀI ĐẶT ứng dụng (PWA).
// KHÔNG cache để tránh dùng bản cũ — mọi yêu cầu vẫn đi thẳng ra mạng như bình thường.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* để mặc định trình duyệt tự tải, không can thiệp */ });
