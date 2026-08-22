import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from './api';
import { useAuth } from './auth.jsx';

// Thông tin giáo xứ dùng chung (tên, logo, giáo phận, gói) — cập nhật liền toàn app.
const ParishContext = createContext(null);

export function ParishProvider({ children }) {
  const { user } = useAuth();
  const [parish, setParish] = useState(null);

  const reload = useCallback(() => {
    if (!user) { setParish(null); return; }
    api.get('/parish').then((r) => setParish(r.data)).catch(() => {});
  }, [user]);
  useEffect(() => { reload(); }, [reload]);

  // Lưu 1 phần thông tin giáo xứ + cập nhật ngay trong context
  const saveParish = useCallback(async (patch) => {
    const r = await api.put('/parish', patch);
    setParish(r.data);
    return r.data;
  }, []);

  return (
    <ParishContext.Provider value={{ parish, setParish, reload, saveParish }}>
      {children}
    </ParishContext.Provider>
  );
}

export function useParish() {
  return useContext(ParishContext) || { parish: null, setParish: () => {}, reload: () => {}, saveParish: async () => {} };
}
