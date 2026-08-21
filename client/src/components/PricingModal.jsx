import { PLANS, PRO_TIERS, isPro } from '../lib/plans';

// Bảng gói: Khởi động (miễn phí, 1 lớp) và Pro (trọn gói, giá theo quy mô/niên khóa)
export default function PricingModal({ current = 'free', onClose }) {
  const currentKey = isPro(current) ? 'pro' : 'free';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Các gói dịch vụ</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tính theo <b>giáo xứ</b>, mỗi <b>niên khóa</b>. Gói Pro chia bậc theo số lớp để công bằng với quy mô.
        </p>
        <div className="pricing-grid two">
          {PLANS.map((p) => (
            <div key={p.key} className={`price-card ${p.tag ? 'featured' : ''} ${currentKey === p.key ? 'current' : ''}`}>
              {p.tag && <div className="price-tag">{p.tag}</div>}
              <div className="price-name">{p.name}</div>
              <div className="price-amount">{p.price}<span className="price-period">{p.period}</span></div>

              {p.key === 'pro' && (
                <div className="pro-tiers">
                  {PRO_TIERS.map((t) => (
                    <div className="pro-tier" key={t.label}>
                      <span>{t.label}</span>
                      <b>{t.price}<span className="price-period">{t.period}</span></b>
                    </div>
                  ))}
                </div>
              )}

              <ul className="price-feats">
                {p.features.map((f, i) => <li key={i}>✓ {f}</li>)}
              </ul>

              {currentKey === p.key
                ? <div className="price-current-badge">Gói hiện tại</div>
                : <button className="btn" style={{ width: '100%' }} onClick={onClose}>{p.key === 'pro' ? 'Liên hệ nâng cấp' : 'Dùng bản này'}</button>}
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Nâng cấp: liên hệ tác giả để được kích hoạt gói Pro cho giáo xứ (thanh toán qua chuyển khoản/VietQR).
        </p>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
