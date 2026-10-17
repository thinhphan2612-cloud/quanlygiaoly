// Điểm thi đua (thang 100) = Học tập + Chuyên cần + Việc thiêng liêng theo tỷ lệ % của từng giáo xứ.
// Tỷ lệ lưu ở parishes.settings.ranking_weights = { study, attendance, spiritual } (tổng 100). Chưa đặt -> mặc định.
export const DEFAULT_RANKING = { study: 50, attendance: 30, spiritual: 20 };

export const RANKING_PARTS = [
  { key: 'study', label: 'Học tập', hint: 'Điểm trung bình các cột điểm (quy ra thang 100)' },
  { key: 'attendance', label: 'Chuyên cần', hint: 'Tỷ lệ có mặt các buổi học (vắng có phép không tính)' },
  { key: 'spiritual', label: 'Việc thiêng liêng', hint: 'Tỷ lệ hoàn thành các việc thiêng liêng' },
];

export function rankingWeights(settings) {
  const w = settings?.ranking_weights;
  if (!w) return DEFAULT_RANKING;
  const v = Object.fromEntries(RANKING_PARTS.map((p) => [p.key, Math.max(0, Number(w[p.key]) || 0)]));
  return Object.values(v).reduce((a, b) => a + b, 0) > 0 ? v : DEFAULT_RANKING;
}

// tb: điểm TB thang 10 (hoặc null), rate và tl: phần trăm 0-100
export function rankingPoints({ tb, rate, tl }, w) {
  const sum = w.study + w.attendance + w.spiritual;
  if (!sum) return 0;
  return Math.round(((tb != null ? tb * 10 : 0) * w.study + (rate || 0) * w.attendance + (tl || 0) * w.spiritual) / sum);
}

// "Học tập 50% + Chuyên cần 30% + Việc thiêng liêng 20%" (bỏ phần 0%)
export function rankingFormula(w) {
  return RANKING_PARTS.filter((p) => w[p.key] > 0).map((p) => `${p.label} ${w[p.key]}%`).join(' + ');
}
