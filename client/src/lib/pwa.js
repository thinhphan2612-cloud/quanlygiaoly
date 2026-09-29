// Hỗ trợ cài đặt PWA: ghi lại sự kiện beforeinstallprompt (Android/Chrome, máy tính)
// để hiện nút "Cài đặt ngay", và các tiện ích nhận diện nền tảng / trạng thái đã cài.
let deferred = null;
const subs = new Set();

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    subs.forEach((f) => f(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((f) => f(false));
  });
  // Đăng ký service worker tối giản để đủ điều kiện cài đặt (không cache).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
}

export function canInstall() { return !!deferred; }

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const res = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (res.outcome === 'accepted') deferred = null;
  return res.outcome === 'accepted';
}

// Đăng ký lắng nghe thay đổi khả năng cài (true = có thể cài, false = đã cài/không còn).
export function onInstallChange(fn) { subs.add(fn); return () => subs.delete(fn); }

// Đang chạy dưới dạng app đã cài (standalone) hay không.
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Nhận diện nền tảng để hiện đúng hướng dẫn.
export function platform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
