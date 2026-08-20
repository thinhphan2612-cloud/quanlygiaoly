// Các gói dịch vụ (giao diện — chưa tích hợp thanh toán)
export const PLANS = [
  {
    key: 'free', name: 'Basic', price: 'Miễn phí', tag: '',
    features: ['Quản lý học viên, lớp, giáo lý viên', 'Điểm danh & điểm số', 'Xuất Excel / PDF', 'Bốc thăm trả bài'],
  },
  {
    key: 'standard', name: 'Standard', price: '110.000đ', period: '/tháng', tag: '',
    features: ['Mọi tính năng Basic', 'Điểm danh việc thiêng liêng', 'Thống kê nâng cao', 'Nhiều giáo lý viên / lớp'],
  },
  {
    key: 'pro', name: 'Pro', price: '165.000đ', period: '/tháng', tag: 'Khuyên dùng',
    features: ['Mọi tính năng Standard', 'Mở khóa Game học giáo lý', 'Thông báo tự động (vắng, admin→GLV)', 'Kiểm toán thu chi', 'Ưu tiên hỗ trợ'],
  },
];

export const PLAN_RANK = { free: 0, standard: 1, pro: 2 };
export const planName = (key) => (PLANS.find((p) => p.key === key)?.name || 'Basic');
// Game mở khóa từ gói Standard trở lên
export const gamesUnlocked = (plan) => (PLAN_RANK[plan] || 0) >= 1;
