import { PLANS } from '../lib/plans';

// Bảng các gói + lợi ích từng gói (bấm Upgrade để xem)
export default function PricingModal({ current = 'free', onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Các gói dịch vụ</h2>
        <p className="muted" style={{ marginTop: 0 }}>Chọn gói phù hợp với giáo xứ. (Thanh toán sẽ bổ sung sau.)</p>
        <div className="pricing-grid">
          {PLANS.map((p) => (
            <div key={p.key} className={`price-card ${p.tag ? 'featured' : ''} ${current === p.key ? 'current' : ''}`}>
              {p.tag && <div className="price-tag">{p.tag}</div>}
              <div className="price-name">{p.name}</div>
              <div className="price-amount">{p.price}<span className="price-period">{p.period || ''}</span></div>
              <ul className="price-feats">
                {p.features.map((f, i) => <li key={i}>✓ {f}</li>)}
              </ul>
              {current === p.key
                ? <div className="price-current-badge">Gói hiện tại</div>
                : <button className="btn" style={{ width: '100%' }} onClick={onClose}>Chọn {p.name}</button>}
            </div>
          ))}
        </div>
        <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}
