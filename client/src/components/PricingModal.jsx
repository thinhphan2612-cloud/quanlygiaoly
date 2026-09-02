import { useEffect, useState } from 'react';
import api from '../api';
import { PLANS, isPro } from '../lib/plans';
import { useAuth } from '../auth.jsx';
import { useParish } from '../parish.jsx';
import { sendContactMessage } from '../lib/contact';

const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';

// Tài khoản nhận tiền (Techcombank) — VietQR
const BANK = { bin: '970407', acc: '168126126', name: 'CONG TY TNHH THIET KE ONETWENTYSIX VERSE' };
const qrUrl = (amount, order) =>
  `https://img.vietqr.io/image/${BANK.bin}-${BANK.acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(order)}&accountName=${encodeURIComponent(BANK.name)}`;

export default function PricingModal({ current = 'free', onClose }) {
  const { user } = useAuth();
  const { parish } = useParish();
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
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
  const isFreeNow = !isPro(current);
  const curMax = parish?.plan_max_classes ?? null;
  const isCurTier = (t) => isPro(current) && curMax != null && t.max_classes === curMax;
  const curTier = tiers.find(isCurTier);
  const curLabel = isFreeNow
    ? 'Khởi động — miễn phí (1 lớp)'
    : curTier ? curTier.label : (curMax ? `Pro — tối đa ${curMax} lớp` : 'Pro — không giới hạn lớp');
  const splitLabel = (lbl) => { const [a, ...rest] = String(lbl || '').split('—'); return [a.trim(), rest.join('—').trim()]; };

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

  async function sendContact() {
    if (!msg.trim()) { alert('Vui lòng nhập lời nhắn'); return; }
    setBusy(true);
    try {
      await sendContactMessage({ user, parish, message: msg, context: 'Nâng cấp: ' + (tier?.label || 'Giáo xứ lớn') });
      setSent(true);
    } catch (e) { alert(e.message || 'Gửi thất bại'); }
    finally { setBusy(false); }
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
            <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Tính theo <b>giáo xứ</b>, mỗi <b>niên khóa</b>. Gói Pro chia mức theo số lớp cho công bằng với quy mô.
            </p>

            <div className="pricing-cur">
              <span className="pc-dot">●</span> Gói hiện tại của bạn: <b>{curLabel}</b>
            </div>

            <div className="tier-cards">
              <div className={`tier-card ${isFreeNow ? 'cur' : ''}`}>
                {isFreeNow && <span className="tc-badge">Gói hiện tại</span>}
                <div className="tc-name">Khởi động</div>
                <div className="tc-range">Miễn phí · quản lý 1 lớp</div>
                <div className="tc-price free">Miễn phí</div>
                {isFreeNow
                  ? <div className="tc-cur">Đang dùng</div>
                  : <div className="tc-note">Mức cơ bản</div>}
              </div>

              {tiers.map((t, i) => {
                const [tname, trange] = splitLabel(t.label);
                const cur = isCurTier(t);
                return (
                  <div className={`tier-card ${cur ? 'cur' : ''}`} key={t.id}>
                    {cur ? <span className="tc-badge">Gói hiện tại</span>
                      : i === 1 ? <span className="tc-badge pop">Phổ biến</span> : null}
                    <div className="tc-name">{tname}</div>
                    <div className="tc-range">{trange || ' '}</div>
                    <div className="tc-price">{t.price == null ? 'Liên hệ' : vnd(t.price)}{t.price != null && <small> / niên khóa</small>}</div>
                    {cur ? <div className="tc-cur">Đang dùng</div>
                      : t.price == null ? <button className="btn ghost" onClick={() => { setTier(t); setStep('pay'); }}>Liên hệ tư vấn</button>
                        : <button className="btn" onClick={() => pickTier(t)}>Chọn mức này</button>}
                  </div>
                );
              })}
              {tiers.length === 0 && <div className="muted" style={{ fontSize: 13, gridColumn: '1 / -1' }}>Đang tải bảng giá…</div>}
            </div>

            <div className="pro-benefits">
              <div className="pb-title">Mọi mức Pro đều gồm:</div>
              <ul className="pb-list">{proFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
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
            <p className="muted" style={{ marginTop: 0 }}>Giáo xứ quy mô lớn được báo giá riêng. Gửi lời nhắn cho chúng tôi — đội ngũ Giáo Lý Số sẽ liên hệ tư vấn &amp; kích hoạt.</p>
            {sent ? (
              <div className="info-box">Đã gửi lời nhắn! Chúng tôi sẽ liên hệ với bạn sớm. Cảm ơn bạn.</div>
            ) : (
              <>
                <div className="field"><label>Lời nhắn</label>
                  <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="VD: Giáo xứ chúng tôi có khoảng 15 lớp, xin được tư vấn gói phù hợp…" /></div>
                <p className="muted" style={{ fontSize: 12 }}>Chúng tôi sẽ phản hồi qua email <b>{user?.email}</b>.</p>
              </>
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setStep('choose')}>← Quay lại</button>
              {!sent && <button className="btn" disabled={busy} onClick={sendContact}>{busy ? 'Đang gửi…' : 'Gửi lời nhắn'}</button>}
            </div>
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
