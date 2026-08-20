// Bí tích đã nhận: tuyến tính Chưa nhận -> Rước lễ -> Thêm Sức
export const SACRAMENTS = {
  none: { value: 'none', label: 'Chưa nhận bí tích', icon: '○', color: '#9aa4bf', bg: '#eef1f8' },
  ruoc_le: { value: 'ruoc_le', label: 'Rước lễ', icon: '🕯️', color: '#2563eb', bg: '#e6efff' },
  them_suc: { value: 'them_suc', label: 'Thêm Sức', icon: '🕊️', color: '#d97706', bg: '#fff3e0' },
};

// Thứ tự nhận bí tích
export const SACRAMENT_OPTIONS = ['none', 'ruoc_le', 'them_suc'];

export default function SacramentBadge({ value }) {
  // Chưa nhận bí tích -> không hiển thị icon
  if (value !== 'ruoc_le' && value !== 'them_suc') return null;
  const s = SACRAMENTS[value];
  return (
    <span className="sac-badge" title={s.label} style={{ background: s.bg, color: s.color }}>
      {s.icon}
    </span>
  );
}
