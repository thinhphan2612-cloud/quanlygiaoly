import { createContext, useContext, useEffect, useState } from 'react';

// Đồng bộ dữ liệu giữa các trang.
// TRƯỚC: mỗi client mở 1 websocket Supabase Realtime nghe 12 bảng -> đụng trần
// ~500-1000 kết nối đồng thời + fan-out RLS khi đông. Nay BỎ websocket, thay bằng
// polling nhẹ: phát 1 "tick" mỗi 60s (chỉ khi tab đang mở) và tick ngay khi user
// quay lại tab. Trang nào dùng useRealtime([...]) làm dependency sẽ tự tải lại theo
// nhịp này -> gần như tức thì, chịu được nghìn user, không giữ kết nối thường trực.
const POLL_MS = 60000;
const RealtimeCtx = createContext(0);

export function RealtimeProvider({ children }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') bump(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') bump(); }; // quay lại tab -> cập nhật ngay
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <RealtimeCtx.Provider value={tick}>{children}</RealtimeCtx.Provider>;
}

// Giữ NGUYÊN chữ ký cũ (tham số bảng bỏ qua) để các trang không phải sửa.
// Trả về số tăng theo nhịp polling -> dùng làm dependency của useEffect để refetch.
export function useRealtime(_tables = []) {
  return useContext(RealtimeCtx);
}
