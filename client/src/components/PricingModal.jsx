import { useEffect, useState } from 'react';
import api from '../api';
import { PLANS, isPro } from '../lib/plans';
import { viError } from '../lib/viError';
import { viDate } from '../lib/date';
import { useAuth } from '../auth.jsx';
import { useParish } from '../parish.jsx';
import { sendContactMessage } from '../lib/contact';
import { toast } from '../lib/toast';

const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';

// Tài khoản nhận tiền (Techcombank) — VietQR
const BANK = { bin: '970407', acc: '168126126', name: 'CONG TY TNHH THIET KE ONETWENTYSIX VERSE' };
const qrUrl = (amount, order) =>
  `https://img.vietqr.io/image/${BANK.bin}-${BANK.acc}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(order)}&accountName=${encodeURIComponent(BANK.name)}`;

// Nhãn bậc trong DB dạng "Giáo xứ nhỏ — tối đa 5 lớp" -> ["Giáo xứ nhỏ", "Tối đa 5 lớp"]
const splitLabel = (lbl) => {
  const [a, ...rest] = String(lbl || '').split(/\s+[—–-]\s+/);
  const b = rest.join(' ').trim();
  return [a.trim(), b ? b[0].toUpperCase() + b.slice(1) : ''];
};
// Giá quy ra mỗi lớp mỗi tháng khi dùng đủ số lớp của bậc (làm tròn nghìn)
const perClassMonth = (t) => (t.price && t.max_classes ? Math.round(t.price / t.max_classes / 12 / 1000) * 1000 : null);

const Tick = () => (
  <svg className="pm-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
);
const CloseBtn = ({ onClick }) => (
  <button type="button" className="pm-x" aria-label="Đóng" onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>
);

export default function PricingModal({ current = 'free', onClose }) {
  const { user } = useAuth();
  const { parish, reload: reloadParish } = useParish();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [tiers, setTiers] = useState(null);
  const [step, setStep] = useState('choose'); // choose | pay | qr
  const [tier, setTier] = useState(null);
  const [code, setCode] = useState('');
  const [disc, setDisc] = useState(null);      // {kind,value} | null
  const [codeMsg, setCodeMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/upgrade/tiers').then((r) => setTiers(r.data || [])).catch(() => setTiers([])); }, []);
  const list = tiers || [];
  const proFeatures = PLANS.find((p) => p.key === 'pro')?.features || [];
  const isFreeNow = !isPro(current);
  const curMax = parish?.plan_max_classes ?? null;
  const isCurTier = (t) => isPro(current) && curMax != null && t.max_classes === curMax;
  const curTier = list.find(isCurTier);
  const curLabel = isFreeNow
    ? 'Khởi động (miễn phí, 1 lớp)'
    : curTier ? `Pro · ${splitLabel(curTier.label)[0]}, ${splitLabel(curTier.label)[1].toLowerCase()}`
      : (curMax ? `Pro, tối đa ${curMax} lớp` : 'Pro, không giới hạn lớp');

  const discountAmount = (price) =>
    !disc ? 0 : disc.kind === 'percent' ? Math.floor((price * disc.value) / 100) : Math.min(disc.value, price);

  // Credit (kiểu Apple): nếu đang Pro còn hạn -> khấu trừ TIỀN phần còn thừa của gói hiện tại.
  const curExp = parish?.plan_expires_at ? new Date(parish.plan_expires_at) : null;
  const curPlanTier = list.find((t) => (t.max_classes ?? null) === (parish?.plan_max_classes ?? null) && t.price != null);
  const proCredit = (isPro(current) && curExp && curExp.getTime() > Date.now() && curPlanTier)
    ? Math.floor(curPlanTier.price * Math.min(365, (curExp.getTime() - Date.now()) / 86400000) / 365)
    : 0;
  const curDaysLeft = curExp ? Math.max(0, Math.ceil((curExp.getTime() - Date.now()) / 86400000)) : 0;
  const payable = (price) => Math.max(0, price - discountAmount(price) - proCredit);

  function pickTier(t) { setTier(t); setCode(''); setDisc(null); setCodeMsg(''); setStep('pay'); }

  async function applyCode() {
    const c = code.trim();
    if (!c) { setDisc(null); setCodeMsg(''); return; }
    setChecking(true); setCodeMsg('');
    try {
      const r = await api.get('/upgrade/discount?code=' + encodeURIComponent(c));
      if (r.data) { setDisc(r.data); setCodeMsg('Đã áp dụng mã giảm giá'); }
      else {
        setDisc(null);
        // Có thể là mã nâng Pro MIỄN PHÍ (pro_free) — nhập nhầm ô; hướng dẫn dùng đúng chỗ.
        let hint = 'Mã không hợp lệ hoặc đã hết hạn';
        try {
          const rr = await api.get('/upgrade/code-remaining?code=' + encodeURIComponent(c));
          if (rr.data && rr.data.kind === 'pro_free' && rr.data.active) {
            hint = 'Đây là mã nâng Pro miễn phí. Bấm "Quay lại" rồi nhập ở mục "Có mã nâng Pro miễn phí?".';
          }
        } catch { /* bỏ qua */ }
        setCodeMsg(hint);
      }
    } catch { setDisc(null); setCodeMsg('Không kiểm tra được mã'); }
    finally { setChecking(false); }
  }

  async function sendContact() {
    if (!msg.trim()) { toast.err('Vui lòng nhập lời nhắn'); return; }
    setBusy(true);
    try {
      await sendContactMessage({ user, parish, message: msg, context: 'Nâng cấp: ' + (tier?.label || 'Giáo xứ lớn') });
      setSent(true);
    } catch (e) { toast.err(viError(e.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  }

  async function pay() {
    setBusy(true);
    try {
      // Chỉ gửi mã khi đã áp dụng hợp lệ (disc). Tránh dính mã sai/không hợp lệ vào đơn.
      const r = await api.post('/upgrade/order', { tier_id: tier.id, code: disc ? code.trim() : null });
      setOrder(r.data); setStep('qr');
    } catch (e) { toast.err(e.response?.data?.error || 'Không tạo được đơn'); }
    finally { setBusy(false); }
  }

  async function redeemFree() {
    const c = redeemCode.trim();
    if (!c) return;
    setRedeeming(true); setRedeemMsg('');
    try {
      const r = await api.post('/upgrade/redeem', { code: c });
      const d = r.data || {};
      setRedeemMsg(`ok:Đã kích hoạt Pro miễn phí ${d.months || ''} tháng${d.tier_label ? ' · ' + splitLabel(d.tier_label)[0] : ''}. Đang tải lại…`);
      reloadParish();
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      setRedeemMsg('err:' + (e.response?.data?.error || 'Mã không hợp lệ'));
    } finally { setRedeeming(false); }
  }

  const [tierName, tierRange] = tier ? splitLabel(tier.label) : ['', ''];
  const popularIdx = list.findIndex((t) => t.max_classes === 12);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide pm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pmTitle">

        {step === 'choose' && (
          <>
            <div className="pm-head">
              <div>
                <h2 id="pmTitle">Các gói dịch vụ</h2>
                <p className="pm-sub">Tính cho cả giáo xứ, mỗi niên khóa. Giá gói Pro theo số lớp của giáo xứ.</p>
              </div>
              <CloseBtn onClick={onClose} />
            </div>

            <div className="pm-cur">
              <span>Đang dùng: <b>{curLabel}</b></span>
              {!isFreeNow && curExp && <span className="pm-cur-exp">Hạn đến {viDate(parish.plan_expires_at)}</span>}
            </div>

            <div className="pm-tiers">
              {tiers === null && [0, 1, 2, 3].map((i) => <div className="pm-tier pm-skel" key={i} />)}
              {list.map((t, i) => {
                const [tname, trange] = splitLabel(t.label);
                const cur = isCurTier(t);
                const per = perClassMonth(t);
                return (
                  <div className={`pm-tier${cur ? ' cur' : ''}${!cur && i === popularIdx ? ' pop' : ''}`} key={t.id}>
                    {cur ? <span className="pm-badge cur">Gói hiện tại</span> : i === popularIdx ? <span className="pm-badge">Phổ biến</span> : null}
                    <div className="pm-tname">{tname}</div>
                    <div className="pm-trange">{trange}</div>
                    <div className="pm-price">{t.price == null ? 'Liên hệ' : vnd(t.price)}</div>
                    <div className="pm-per">{t.price == null ? 'Báo giá theo quy mô' : '/ niên khóa'}</div>
                    <div className="pm-hint">{per ? `≈ ${vnd(per)} / lớp / tháng` : ' '}</div>
                    {t.price == null
                      ? <button className="btn ghost" onClick={() => { setTier(t); setStep('pay'); }}>Liên hệ tư vấn</button>
                      : cur
                        ? <button className="btn ghost" onClick={() => pickTier(t)}>Gia hạn</button>
                        : <button className="btn" onClick={() => pickTier(t)}>{isFreeNow ? 'Chọn gói này' : 'Chọn mức này'}</button>}
                  </div>
                );
              })}
              {tiers !== null && list.length === 0 && <div className="muted pm-empty">Chưa tải được bảng giá. Vui lòng thử lại sau.</div>}
            </div>
            {!isFreeNow && <p className="pm-note">Gia hạn hoặc đổi mức: chu kỳ 1 năm mới tính từ hôm nay, phần còn lại của gói hiện tại được trừ vào số tiền.</p>}

            <div className="pm-feats">
              <div className="pm-feats-h">Mọi mức Pro đều có</div>
              <ul>{proFeatures.map((f, i) => <li key={i}><Tick />{f}</li>)}</ul>
            </div>

            <div className="pm-foot">
              {redeemOpen ? (
                <div className="pm-redeem">
                  <input value={redeemCode} autoFocus onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') redeemFree(); }} placeholder="Nhập mã nâng Pro miễn phí" />
                  <button className="btn" onClick={redeemFree} disabled={redeeming || !redeemCode.trim()}>{redeeming ? 'Đang áp dụng…' : 'Áp dụng'}</button>
                </div>
              ) : (
                <button type="button" className="pm-link" onClick={() => setRedeemOpen(true)}>Có mã nâng Pro miễn phí?</button>
              )}
              <span className="pm-pay-note">Thanh toán bằng chuyển khoản, kích hoạt trong ngày làm việc.</span>
            </div>
            {redeemMsg && <p className={`pm-msg ${redeemMsg.startsWith('ok:') ? 'ok' : 'err'}`}>{redeemMsg.slice(redeemMsg.indexOf(':') + 1)}</p>}
          </>
        )}

        {step === 'pay' && tier && tier.price != null && (
          <>
            <div className="pm-head">
              <div>
                <h2 id="pmTitle">{isCurTier(tier) ? 'Gia hạn gói Pro' : 'Nâng cấp gói Pro'}</h2>
                <p className="pm-sub">{tierName}{tierRange ? `, ${tierRange.toLowerCase()}` : ''} · 1 niên khóa</p>
              </div>
              <CloseBtn onClick={onClose} />
            </div>
            <div className="pay-summary">
              <div className="row"><span>Giá gói (1 năm)</span><b>{vnd(tier.price)}</b></div>
              {disc && <div className="row pm-ok"><span>Giảm ({disc.kind === 'percent' ? disc.value + '%' : vnd(disc.value)})</span><b>-{vnd(discountAmount(tier.price))}</b></div>}
              {proCredit > 0 && <div className="row pm-ok"><span>Trừ phần còn lại của gói hiện tại ({curDaysLeft} ngày)</span><b>-{vnd(proCredit)}</b></div>}
              <div className="row total"><span>Cần thanh toán</span><b>{vnd(payable(tier.price))}</b></div>
            </div>
            {proCredit > 0 && <p className="pm-note" style={{ marginTop: 0 }}>Chu kỳ 1 năm mới tính từ hôm nay; phần còn thừa của gói cũ đã quy đổi thành tiền và trừ vào ở trên.</p>}
            <div className="field">
              <label>Mã giảm giá (nếu có)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={code} onChange={(e) => { setCode(e.target.value); setDisc(null); setCodeMsg(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCode(); }} placeholder="Nhập mã" style={{ flex: 1 }} />
                <button className="btn ghost" onClick={applyCode} disabled={checking || !code.trim()}>{checking ? 'Đang kiểm tra…' : 'Áp dụng'}</button>
              </div>
              {codeMsg && <p className={`pm-msg ${disc ? 'ok' : 'err'}`}>{codeMsg}</p>}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setStep('choose')}>Quay lại</button>
              <button className="btn" onClick={pay} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo mã chuyển khoản'}</button>
            </div>
          </>
        )}

        {step === 'pay' && tier && tier.price == null && (
          <>
            <div className="pm-head">
              <div>
                <h2 id="pmTitle">{tierName}</h2>
                <p className="pm-sub">{tierRange ? `${tierRange}. ` : ''}Giáo xứ quy mô lớn được báo giá riêng.</p>
              </div>
              <CloseBtn onClick={onClose} />
            </div>
            {sent ? (
              <div className="info-box">Đã gửi lời nhắn. Chúng tôi sẽ liên hệ với bạn sớm, cảm ơn bạn.</div>
            ) : (
              <>
                <div className="field"><label>Lời nhắn</label>
                  <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="VD: Giáo xứ chúng tôi có khoảng 25 lớp, xin được tư vấn gói phù hợp" /></div>
                <p className="muted" style={{ fontSize: 13 }}>Chúng tôi sẽ phản hồi qua email <b>{user?.email}</b>.</p>
              </>
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setStep('choose')}>Quay lại</button>
              {!sent && <button className="btn" disabled={busy} onClick={sendContact}>{busy ? 'Đang gửi…' : 'Gửi lời nhắn'}</button>}
            </div>
          </>
        )}

        {step === 'qr' && order && (
          <>
            <div className="pm-head">
              <div>
                <h2 id="pmTitle">Quét mã để chuyển khoản</h2>
                <p className="pm-sub">Mở ứng dụng ngân hàng, quét mã QR. Số tiền và nội dung đã điền sẵn.</p>
              </div>
              <CloseBtn onClick={onClose} />
            </div>
            <div className="qr-wrap">
              <img className="qr-img" src={qrUrl(order.final_amount, order.order_code)} alt="Mã VietQR chuyển khoản" />
              <div className="qr-info">
                <div className="row"><span>Số tiền</span><b className="pm-ok">{vnd(order.final_amount)}</b></div>
                <div className="row"><span>Nội dung CK</span><b>{order.order_code}</b></div>
                <div className="row"><span>Ngân hàng</span><b>Techcombank</b></div>
                <div className="row"><span>Số tài khoản</span><b>{BANK.acc}</b></div>
                <div className="row"><span>Chủ TK</span><b style={{ fontSize: 12 }}>{BANK.name}</b></div>
              </div>
            </div>
            <p className="pm-note">
              Vui lòng chuyển <b>đúng số tiền</b> và giữ nguyên nội dung <b>{order.order_code}</b> để đối soát.
              Gói Pro được kích hoạt sau khi chúng tôi xác nhận đã nhận thanh toán, thường trong ngày làm việc.
            </p>
            <div className="modal-actions"><button className="btn" onClick={onClose}>Đã hiểu</button></div>
          </>
        )}
      </div>
    </div>
  );
}
