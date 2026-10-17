import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import { useParish } from '../parish.jsx';
import { isPro } from '../lib/plans';
import { IconExt, IconGame } from '../components/Icons.jsx';

// Địa chỉ chính của store (ephatastore.com chuyển hướng 308 sang www)
const STORE_URL = (import.meta.env.VITE_EPHATA_URL || 'https://www.ephatastore.com').replace(/\/$/, '');
// API công khai của store: sản phẩm nổi bật (CORS mở, CDN giữ 10 phút)
const FEATURED_API = `${STORE_URL}/api/public/v1/featured?limit=9`;
// Tiện ích Giáo Lý Số đã mở -> trang dùng trong app
const FEATURE_ROUTE = { exam: '/exams', certificate: '/certificates', game: '/games' };
// Font của store (Lora cho tiêu đề, Be Vietnam Pro cho chữ), chỉ tải khi mở tab này
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Lora:wght@600;700&display=swap';

function useStoreFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-epx-font]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_HREF; l.dataset.epxFont = '1';
    document.head.appendChild(l);
  }, []);
}
const ext = { target: '_blank', rel: 'noopener noreferrer' };

export default function EphataStore() {
  useStoreFonts();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { parish } = useParish();
  const isAdmin = user?.role === 'admin';
  const pro = isPro(parish?.plan) && (!parish?.plan_expires_at || new Date(parish.plan_expires_at) > new Date());
  const [features, setFeatures] = useState([]);
  const [ownedKeys, setOwnedKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null); // { total, free, products } | 'error'

  useEffect(() => {
    Promise.all([
      api.get('/features').then((r) => r.data).catch(() => []),
      api.get('/entitlements').then((r) => r.data?.keys || []).catch(() => []),
    ]).then(([f, keys]) => { setFeatures(f); setOwnedKeys(keys); }).finally(() => setLoading(false));
    const ctl = new AbortController();
    fetch(FEATURED_API, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => setStore({ ...d, products: (d.products || []).filter((p) => p.slug !== 'giao-ly-so').slice(0, 8) }))
      .catch((e) => { if (e.name !== 'AbortError') setStore('error'); });
    return () => ctl.abort();
  }, []);

  const owned = features.filter((f) => ownedKeys.includes(f.key));
  const explore = features.filter((f) => !ownedKeys.includes(f.key));
  const featureLink = (f) => (f.config?.store_slug ? `${STORE_URL}/product/${f.config.store_slug}` : `${STORE_URL}/?q=${encodeURIComponent(f.name)}`);
  const stats = store && store !== 'error' ? store : null;

  return (
    <div className="epx">
      {/* ---------- Giới thiệu ---------- */}
      <section className="epx-hero">
        <div className="epx-hero-text">
          <img className="epx-logo" src="/ephata-logo.png" alt="Ephata Store" width="140" height="60" />
          <div className="epx-kicker">Ephata Store · cộng đồng Công giáo</div>
          <h1 className="epx-h1">Công cụ số cho giáo xứ <span>&amp; cộng đoàn.</span></h1>
          <p className="epx-lead">
            {stats ? `${stats.total} sản phẩm, ${stats.free} có bản miễn phí: ` : ''}
            ứng dụng, biểu mẫu, thiết kế, tài liệu và game giáo lý, do người Công giáo làm cho cộng đồng Công giáo.
          </p>
          <div className="epx-points">
            <span><b>✦</b> Rõ đối tượng: linh mục, giáo lý viên, giáo dân</span>
            <span><b>▦</b> Tất cả trong một nơi</span>
            <span><b>⚡</b> Dùng ngay trên web</span>
          </div>
          <div className="epx-cta">
            <a className="epx-btn gold" href={STORE_URL} {...ext}>Khám phá Ephata Store <IconExt /></a>
            <a className="epx-btn" href={`${STORE_URL}/login`} {...ext}>Đăng nhập bằng tài khoản Giáo Lý Số <IconExt /></a>
          </div>
          <p className="epx-note">Không cần tạo tài khoản mới: đăng nhập store bằng đúng email và mật khẩu Giáo Lý Số, hệ thống tự liên kết.</p>
        </div>
        <div className="epx-hero-art" aria-hidden="true">
          {(stats?.products || []).slice(0, 3).map((p, i) => (
            <div key={p.slug} className={`epx-float f${i}`}>{p.coverUrl ? <img src={p.coverUrl} alt="" /> : <span>{p.icon || '◈'}</span>}</div>
          ))}
          {!stats && <div className="epx-float f0 epx-glyph">✝</div>}
        </div>
      </section>

      {/* ---------- Ưu đãi cho giáo xứ ---------- */}
      <section className="epx-perks">
        <div className={`epx-perk${pro ? ' on' : ''}`}>
          <div className="epx-perk-h">Miễn phí với Pro Giáo Lý Số</div>
          <p>{pro
            ? 'Giáo xứ bạn đang dùng gói Pro: các sản phẩm có nhãn "Miễn phí với Pro" dùng miễn phí khi gói còn hạn.'
            : 'Các sản phẩm có nhãn "Miễn phí với Pro" dùng miễn phí khi giáo xứ có gói Pro Giáo Lý Số còn hạn.'}</p>
        </div>
        <div className="epx-perk">
          <div className="epx-perk-h">Full Topping</div>
          <p>Gói năm dùng mọi sản phẩm trả phí trên store (trừ phần mềm cần khóa bản quyền và tiện ích của Giáo Lý Số).</p>
        </div>
      </section>

      {/* ---------- App nổi bật ---------- */}
      <section className="epx-sec">
        <div className="epx-sec-head">
          <div><div className="epx-kicker">Nổi bật trên store</div><h2 className="epx-h2">App được yêu thích</h2></div>
          <a className="epx-more" href={STORE_URL} {...ext}>Xem tất cả <IconExt /></a>
        </div>
        {store === null ? (
          <div className="epx-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="epx-card epx-skel" />)}</div>
        ) : store === 'error' || !store.products.length ? (
          <div className="epx-fallback">
            <p>Chưa tải được danh sách app nổi bật. Bạn vẫn xem đầy đủ sản phẩm trên Ephata Store.</p>
            <a className="epx-btn gold" href={STORE_URL} {...ext}>Mở Ephata Store <IconExt /></a>
          </div>
        ) : (
          <div className="epx-grid">
            {store.products.map((p) => (
              <a key={p.slug} className="epx-card" href={p.url || `${STORE_URL}/product/${p.slug}`} {...ext}>
                <span className="epx-cover">
                  {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : <span className="epx-cover-ph">{p.icon || '◈'}</span>}
                  {(p.isNew || p.isPopular) && <span className="epx-ribbon">{p.isNew ? 'Mới' : 'Phổ biến'}</span>}
                </span>
                <span className="epx-card-body">
                  <span className="epx-card-top">
                    {p.logoUrl && <img className="epx-app-logo" src={p.logoUrl} alt="" loading="lazy" />}
                    <span className="epx-card-title">{p.title}</span>
                  </span>
                  <span className="epx-tagline">{p.tagline}</span>
                  <span className="epx-badges">
                    <span className="epx-type">{p.typeLabel}</span>
                    {p.giaolyProFree ? <span className="epx-badge pro">Miễn phí với Pro</span>
                      : p.tier === 'free' ? <span className="epx-badge free">Miễn phí</span>
                        : p.hasFree ? <span className="epx-badge free">Có bản miễn phí</span>
                          : <span className="epx-badge">{p.priceLabel}</span>}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Cách mua ---------- */}
      <section className="epx-sec">
        <div className="epx-kicker">Mua thế nào</div>
        <h2 className="epx-h2">3 bước là dùng được</h2>
        <ol className="epx-steps">
          <li><b>Đăng nhập</b><span>Bằng chính tài khoản Giáo Lý Số. Sản phẩm miễn phí mở được ngay.</span></li>
          <li><b>Nạp point</b><span>Chuyển khoản qua mã VietQR, 100đ = 1 point. Point vào ví sau khi store đối soát.</span></li>
          <li><b>Mua và dùng</b><span>Dùng ngay trên web. Tiện ích mua cho giáo xứ tự mở trong Giáo Lý Số, hiện ở mục bên dưới.</span></li>
        </ol>
      </section>

      {/* ---------- Tiện ích cho Giáo Lý Số ---------- */}
      <section className="epx-sec">
        <div className="epx-sec-head">
          <div><div className="epx-kicker">Dành cho Giáo Lý Số</div><h2 className="epx-h2">Tiện ích của giáo xứ</h2></div>
        </div>
        {loading ? <p className="epx-muted">Đang tải…</p> : (
          <>
            {owned.length > 0 && (
              <div className="epx-feat-grid">
                {owned.map((f) => (
                  <div className="epx-feat on" key={f.key}>
                    <div className="epx-feat-h"><b>{f.name}</b><span className="epx-badge free">Đã mở</span></div>
                    {f.description && <p>{f.description}</p>}
                    {FEATURE_ROUTE[f.key] && <button type="button" className="epx-btn sm gold" onClick={() => navigate(FEATURE_ROUTE[f.key])}>Mở</button>}
                  </div>
                ))}
              </div>
            )}
            {explore.length > 0 && (
              <>
                <p className="epx-muted epx-sub">{owned.length ? 'Thêm cho giáo xứ.' : 'Giáo xứ chưa mở tiện ích nào.'} {isAdmin ? 'Bạn là quản trị viên nên mua được cho cả giáo xứ.' : 'Chỉ quản trị viên giáo xứ mua được tiện ích cho cả giáo xứ.'}</p>
                <div className="epx-feat-grid">
                  {explore.map((f) => (
                    <div className="epx-feat" key={f.key}>
                      <div className="epx-feat-h"><b>{f.name}</b>{f.price && <span className="epx-badge">{f.price}</span>}</div>
                      {f.description && <p>{f.description}</p>}
                      <a className="epx-btn sm" href={featureLink(f)} {...ext}>Xem trên store <IconExt /></a>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!owned.length && !explore.length && <p className="epx-muted">Chưa có tiện ích nào cho Giáo Lý Số trên store.</p>}
          </>
        )}
        <button type="button" className="epx-gamelink" onClick={() => navigate('/games')}>
          <IconGame /><span><b>Game học giáo lý</b><small>Game thêm từ store hiện ở trang Game học. Bấm để mở.</small></span>
        </button>
      </section>
    </div>
  );
}
