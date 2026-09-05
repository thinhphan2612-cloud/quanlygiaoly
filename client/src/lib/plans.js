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
      'Nhiều lớp theo mức gói (nhỏ / vừa / lớn) & không giới hạn giáo lý viên',
      'Nhiều giáo lý viên phối hợp trên mỗi lớp',
      'Hồ sơ học viên trọn đời: cá nhân, cha mẹ, người đỡ đầu',
      'Theo dõi bí tích: Rửa Tội · Rước Lễ · Thêm Sức',
      'Xuất chứng chỉ bí tích trang trọng (in / PDF)',
      'Điểm số theo hệ số, xếp hạng thi đua, xuất Excel / PDF',
      'Điểm danh việc thiêng liêng + thống kê tuần / tháng',
      'Gửi thông báo tới giáo lý viên',
      'Kiểm toán thu chi quỹ lớp / giáo xứ',
      'Tự động lên lớp cuối năm & lưu trữ các niên khóa cũ',
      'Dashboard tổng quan: sĩ số, chuyên cần, bí tích',
      'Đồng bộ thời gian thực giữa cha sở & giáo lý viên',
      'Game học giáo lý & ưu tiên hỗ trợ',
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
