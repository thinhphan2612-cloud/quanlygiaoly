// Service worker DUY NHẤT của Giáo Lý Số. Trình duyệt chỉ giữ 1 SW cho mỗi scope '/',
// nên mọi chỗ trong app đều đăng ký file này (KHÔNG đăng ký riêng game-sw.js nữa,
// nếu không 2 bản sẽ đè nhau và mất proxy game).
// - Đủ điều kiện cài đặt ứng dụng (PWA). KHÔNG cache, mọi yêu cầu đi mạng như bình thường.
// - Proxy game /game-proxy/... (logic trong game-sw.js).
importScripts('/game-sw.js');
