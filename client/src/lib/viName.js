// Sắp xếp tên người Việt theo TÊN (từ cuối của họ và tên), rồi tới phần còn lại.
// VD: "Nguyễn Văn An" -> khóa "An Nguyễn Văn".
export function viNameKey(name = '') {
  const p = String(name).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  const given = p[p.length - 1];
  return (given + ' ' + p.slice(0, -1).join(' ')).trim();
}

export function byViName(a, b, field = 'full_name') {
  return viNameKey(a?.[field]).localeCompare(viNameKey(b?.[field]), 'vi');
}
