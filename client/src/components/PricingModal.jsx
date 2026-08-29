import { useEffect, useState } from 'react';
import api from '../api';
import { PLANS, isPro } from '../lib/plans';

const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';

// Tài khoản nhận tiền (Techcombank) — VietQR
const BANK = { bin: '970407', acc: '168126126', name: 'CONG TY TNHH THIET KE ONETWENTYSIX VERSE' };
const qrUrl = (amount, order) =>
  `https://img.vietqr.io/image/${BANK.bin}-${BANK.acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(order)}&accountName=${encodeURIComponent(BANK.name)}`;

export default function PricingModal({ current = 'free', onClose }) {
  const currentKey = isPro(current) ? 'pro' : 'free';
  const [tiers, setTiers] = useState([]);
  const [step, setStep] = useState('choose'); // choose | pay | qr
  const [tier, setTier] = useState(null);
  const [code, setCode] = useState('');
  const [disc, setDisc] = useState(null);      // {kind,value} | null
  const [codeMsg, setCodeMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/upgrade/tiers').then((r) => setTiers(r.data)).catch(() => {}); }, []);
  const proFeatures = PLANS.find((p) => p.key === 'pro')?.features || [];
  const freePlan = PLANS.find((p) => p.key === 'free');

  const discountAmount = (price) =>
    !disc ? 0 : disc.kind === 'percent' ? Math.floor((price * disc.value) / 100) : Math.min(disc.value, price);

  function pickTier(t) { setTier(t); setCode(''); setDisc(null); setCodeMsg(''); setStep('pay'); }

  async function applyCode() {
    const c = code.trim();
    if (!c) { setDisc(null); setCodeMsg(''); return; }
    setChecking(true); setCodeMsg('');
    try {
      const r = await api.get('/upgrade/discount?code=' + encodeURIComponent(c));
      if (r.data) { setDisc(r.data); setCodeMsg('✓ Đã áp dụng mã giảm giá'); }
      else { setDisc(null); setCodeMsg('Mã không hợp lệ hoặc đã hết hạn'); }
    } catch { setDisc(null); setCodeMsg('Không kiểm tra được mã'); }
    finally { setChecking(false); }
  }

  async function pay() {
    setBusy(true);
    try {
      const r = await api.post('/upgrade/order', { tier_id: tier.id, code: code.trim() || null });
      setOrder(r.data); setStep('qr');
    } catch (e) { alert(e.response?.data?.error || 'Không tạo được đơn'); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>

        {step === 'choose' && (
          <>
            <h2 style={{ marginTop: 0 }}>Các gói dịch vụ</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Tính theo <b>giáo xứ</b>, mỗi <b>niên khóa</b>. Gói Pro chia bậc theo số lớp để công bằng với quy mô.
            </p>
            <div className="pricing-grid two">
              <div className={`price-card ${currentKey === 'free' ? 'current' : ''}`}>
                <div className="price-name">{freePlan?.name || 'Khởi động'}</div>
                <div className="price-amount">Miễn phí</div>
                <ul className="price-feats">{(freePlan?.features || []).map((f, i) => <li key={i}>✓ {f}</li>)}</ul>
                {currentKey === 'free' && <div className="price-current-badge">Gói hiện tại</div>}
              </div>

              <div className="price-card featured">
                <div className="price-tag">Khuyên dùng</div>
                <div className="price-name">Pro (trọn gói)</div>
                <div className="price-amount" style={{ fontSize: 18 }}>Theo quy mô<span className="price-period">/niên khóa</span></div>
                <div className="pro-tiers">
                  {tiers.map((t) => (
                    <div className="pro-tier" key={t.id}>
                      <span>{t.label}</span>
                      {t.price == null
                        ? <button className="btn ghost sm" onClick={() => { setTier(t); setStep('pay'); }}>Liên hệ</button>
                        : <button className="btn sm" onClick={() => pickTier(t)}>{vnd(t.price)} · Chọn</button>}
                    </div>
                  ))}
                  {tiers.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Đang tải bảng giá…</div>}
                </div>
                <ul className="price-feats">{proFeatures.map((f, i) => <li key={i}>✓ {f}</li>)}</ul>
              </div>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Đóng</button></div>
          </>
        )}

        {step === 'pay' && tier && tier.price != null && (
          <>
            <h2 style={{ marginTop: 0 }}>Nâng cấp Pro — {tier.label}</h2>
            <div className="pay-summary">
              <div className="row"><span>Giá gói</span><b>{vnd(tier.price)}</b></div>
              {disc && <div className="row" style={{ color: '#15803d' }}><span>Giảm ({disc.kind === 'percent' ? disc.value + '%' : vnd(disc.value)})</span><b>-{vnd(discountAmount(tier.price))}</b></div>}
              <div className="row total"><span>Thanh toán</span><b>{vnd(tier.price - discountAmount(tier.price))}</b></div>
            </div>
            <div className="field">
              <label>Mã giảm giá (nếu có)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={code} onChange={(e) => { setCode(e.target.value); setDisc(null); setCodeMsg(''); }} placeholder="Nhập mã…" style={{ flex: 1 }} />
                <button className="btn ghost" onClick={applyCode} disabled={checking}>{checking ? '…' : 'Áp dụng'}</button>
              </div>
              {codeMsg && <p className="muted" style={{ fontSize: 12, marginTop: 4, color: disc ? '#15803d' : '#c0392b' }}>{codeMsg}</p>}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setStep('choose')}>← Quay lại</button>
              <button className="btn" onClick={pay} disabled={busy}>{busy ? 'Đang tạo…' : 'Thanh toán'}</button>
            </div>
          </>
        )}

        {step === 'pay' && tier && tier.price == null && (
          <>
            <h2 style={{ marginTop: 0 }}>{tier.label}</h2>
            <p className="muted">Giáo xứ quy mô lớn được báo giá riêng. Vui lòng liên hệ để được tư vấn và kích hoạt.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a className="btn" href="mailto:support.giaolyso@gmail.com?subject=Nâng cấp Pro - giáo xứ lớn">✉ Gửi email liên hệ</a>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setStep('choose')}>← Quay lại</button></div>
          </>
        )}

        {step === 'qr' && order && (
          <>
            <h2 style={{ marginTop: 0 }}>Quét mã để chuyển khoản</h2>
            <div className="qr-wrap">
              <img className="qr-img" src={qrUrl(order.final_amount, order.order_code)} alt="VietQR" />
              <div className="qr-info">
                <div className="row"><span>Số tiền</span><b style={{ color: '#15803d' }}>{vnd(order.final_amount)}</b></div>
                <div className="row"><span>Nội dung CK</span><b>{order.order_code}</b></div>
                <div className="row"><span>Ngân hàng</span><b>Techcombank</b></div>
                <div className="row"><span>Số tài khoản</span><b>{BANK.acc}</b></div>
                <div className="row"><span>Chủ TK</span><b style={{ fontSize: 12 }}>{BANK.name}</b></div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>
              Vui lòng chuyển khoản <b>đúng số tiền</b> và giữ nội dung <b>{order.order_code}</b> để đối soát.
              Gói Pro sẽ được kích hoạt sau khi chúng tôi xác nhận nhận được thanh toán (thường trong ngày làm việc).
            </p>
            <div className="modal-actions"><button className="btn" onClick={onClose}>Đã hiểu</button></div>
          </>
        )}
      </div>
    </div>
  );
}
