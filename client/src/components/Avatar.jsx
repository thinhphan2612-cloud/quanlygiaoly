// Avatar học viên/tài khoản: hiện ảnh nếu có, ngược lại hiện chữ tắt.
function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}

export default function Avatar({ url, name, size = 32, className = '' }) {
  if (url) return <img className={`av-img ${className}`} style={{ width: size, height: size }} src={url} alt="" />;
  return <div className={`av-init ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{initials(name)}</div>;
}
