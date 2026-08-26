import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth.jsx';

// Nghe thay đổi Postgres (Supabase Realtime) và tăng "rev" theo từng bảng.
// Trang nào cần đồng bộ tức thời thì dùng useRealtime([...bảng]) làm dependency để tải lại.
const TABLES = [
  'students', 'classes', 'grades', 'grade_columns', 'attendance',
  'spiritual_records', 'spiritual_tasks', 'class_teachers', 'transactions',
  'school_years', 'notifications', 'profiles',
];
const RealtimeCtx = createContext({});

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [revs, setRevs] = useState({});

  useEffect(() => {
    if (!user) { setRevs({}); return; }
    const ch = supabase.channel('rt-main');
    TABLES.forEach((t) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        setRevs((r) => ({ ...r, [t]: (r[t] || 0) + 1 }));
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return <RealtimeCtx.Provider value={revs}>{children}</RealtimeCtx.Provider>;
}

// Trả về 1 số thay đổi mỗi khi một trong các bảng được truyền vào có cập nhật.
export function useRealtime(tables = []) {
  const revs = useContext(RealtimeCtx);
  let sum = 0;
  for (const t of tables) sum += revs[t] || 0;
  return sum;
}
