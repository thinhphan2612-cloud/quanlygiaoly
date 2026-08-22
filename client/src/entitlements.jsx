import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from './api';
import { useAuth } from './auth.jsx';

// Nền entitlement: nạp danh sách tính năng giáo xứ đang có quyền dùng.
// hasFeature('exam') -> true/false. Store Ethata Store sẽ ghi quyền vào DB;
// app chỉ đọc và mở module tương ứng.
const EntitlementsContext = createContext(null);

export function EntitlementsProvider({ children }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!user) { setKeys(new Set()); setLoading(false); return; }
    setLoading(true);
    api.get('/entitlements')
      .then((r) => setKeys(new Set(r.data.keys || [])))
      .catch(() => setKeys(new Set()))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const has = useCallback((key) => keys.has(key), [keys]);

  return (
    <EntitlementsContext.Provider value={{ has, keys, loading, reload }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  return useContext(EntitlementsContext) || { has: () => false, keys: new Set(), loading: false, reload: () => {} };
}

// Tiện dùng nhanh trong component: const canExam = useFeature('exam');
export function useFeature(key) {
  return useEntitlements().has(key);
}
