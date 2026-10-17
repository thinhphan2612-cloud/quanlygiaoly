// Mô hình gói: theo GIÁO XỨ, 2 tầng (Khởi động / Pro), Pro phân bậc theo số lớp,
// tính theo NIÊN KHÓA. Bản Khởi động giới hạn 1 lớp.

// Chuẩn hóa: mọi giá trị khác 'free' đều coi là 'pro' (gộp 'standard' cũ nếu còn)
const norm = (p) => (p === 'free' ? 'free' : 'pro');
export const PLAN_RANK = { free: 0, pro: 1 };
export const rank = (p) => PLAN_RANK[norm(p)] ?? 0;
export const isPro = (p) => norm(p) === 'pro';
export const planName = (p) => (norm(p) === 'free' ? 'Khởi động' : 'Pro');

// Bản Khởi động chỉ quản lý 1 lớp
export const FREE_MAX_CLASSES = 1;

export const PLANS = [
  {
    key: 'free', name: 'Khởi động', price: 'Miễn phí', period: '', tag: '',
    features: [
      'Quản lý 1 lớp giáo lý',
      'Học viên, điểm danh, điểm số',
      'Xuất Excel / PDF, bốc thăm trả bài',
    ],
  },
  {
    key: 'pro', name: 'Pro (trọn gói)', price: 'Theo quy mô', period: '/niên khóa', tag: 'Khuyên dùng',
    features: [
      'Nhiều lớp theo mức gói, không giới hạn giáo lý viên',
      'Nhiều giáo lý viên cùng phụ trách một lớp',
      'Hồ sơ học viên và bí tích trọn đời',
      'Chứng chỉ bí tích, giấy khen (in / PDF)',
      'Điểm số theo hệ số, xếp hạng thi đua',
      'Việc thiêng liêng, thống kê tuần / tháng',
      'Thi online tự chấm, game học giáo lý',
      'Tự động lên lớp, lưu trữ các năm cũ',
      'Thông báo tới giáo lý viên, sổ thu chi',
      'Ưu tiên hỗ trợ',
    ],
  },
];

// Bậc giá Pro theo quy mô giáo xứ (SỐ TIỀN LÀ TẠM — Felix chốt sau khi khảo sát)
export const PRO_TIERS = [
  { label: 'Giáo xứ nhỏ — tối đa 5 lớp', price: '1.500.000đ', period: '/niên khóa' },
  { label: 'Giáo xứ vừa — 6 đến 12 lớp', price: '2.900.000đ', period: '/niên khóa' },
  { label: 'Giáo xứ lớn — 13 đến 20 lớp', price: '5.200.000đ', period: '/niên khóa' },
  { label: 'Giáo xứ rất lớn — trên 20 lớp', price: 'Liên hệ', period: '' },
];

// Game mở khóa khi gói của giáo xứ đạt gói tối thiểu của game
export const gamesUnlocked = (plan, minPlan = 'pro') => rank(plan) >= rank(minPlan);
