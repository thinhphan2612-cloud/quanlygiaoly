import { useEffect, useState } from 'react';
import api from '../api';
import { IconExt } from '../components/Icons.jsx';

const STORE_URL = 'https://ephatastore.com';

export default function EphataStore() {
  const [features, setFeatures] = useState([]);
  const [ownedKeys, setOwnedKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/features').then((r) => r.data).catch(() => []),
      api.get('/entitlements').then((r) => r.data?.keys || []).catch(() => []),
    ]).then(([f, keys]) => { setFeatures(f); setOwnedKeys(keys); }).finally(() => setLoading(false));
  }, []);

  const owned = features.filter((f) => ownedKeys.includes(f.key));
  const explore = features.filter((f) => !ownedKeys.includes(f.key));

  return (
    <div>
      <div className="att-head" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Ephata Store</h1>
        <a className="btn btn-ext" href={STORE_URL} target="_blank" rel="noopener noreferrer">Đăng nhập Ephata Store <IconExt /></a>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>
        Kho ứng dụng &amp; tiện ích Công giáo. Đăng nhập bằng <b>chính tài khoản Giáo Lý Số</b> của bạn — tài khoản tự liên kết. Tính năng đã mua / thêm sẽ hiện tại đây để dùng ngay trong ứng dụng.
      </p>

      {loading ? <div className="panel"><p className="muted">Đang tải…</p></div> : (
        <>
          <div className="panel">
            <div className="card-head"><h2 style={{ margin: 0 }}>Đã sở hữu ({owned.length})</h2></div>
            {owned.length === 0 ? (
              <p className="muted">Chưa có tiện ích nào. Khám phá &amp; thêm từ Ephata Store bên dưới.</p>
            ) : (
              <div className="store-grid">
                {owned.map((f) => (
                  <div className="store-card owned" key={f.key}>
                    <div className="sc-name">{f.name}</div>
                    {f.description && <div className="sc-desc">{f.description}</div>}
                    <div className="sc-foot">
                      <span className="plan-badge pro">Đã kích hoạt</span>
                      <span className="muted" style={{ fontSize: 12 }}>Dùng trong ứng dụng</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {explore.length > 0 && (
            <div className="panel">
              <div className="card-head"><h2 style={{ margin: 0 }}>Khám phá thêm</h2></div>
              <div className="store-grid">
                {explore.map((f) => (
                  <div className="store-card" key={f.key}>
                    <div className="sc-name">{f.name}</div>
                    {f.description && <div className="sc-desc">{f.description}</div>}
                    <div className="sc-foot">
                      {f.price && <span className="muted" style={{ fontSize: 13 }}>{f.price}</span>}
                      <a className="btn sm btn-ext" href={STORE_URL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>Xem <IconExt /></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
