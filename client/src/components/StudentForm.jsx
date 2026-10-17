import { SACRAMENTS, SACRAMENT_OPTIONS, CERT_SUGGESTIONS } from './SacramentBadge.jsx';

// Ngày bí tích -> trạng thái tối thiểu tương ứng (nhập ngày thì trạng thái tự nâng lên, không bị lệch)
const SAC_BY_DATE = { baptism_date: 'baptism', first_communion_date: 'ruoc_le', confirmation_date: 'them_suc' };
const sacRank = (k) => SACRAMENT_OPTIONS.indexOf(k || 'none');
const PHONE_RE = /^[0-9+\s.()-]{8,16}$/;
const PHONE_FIELDS = [['father_phone', 'SĐT cha'], ['mother_phone', 'SĐT mẹ'], ['student_phone', 'SĐT học viên']];

// Kiểm tra trước khi lưu. Trả về câu lỗi (tiếng Việt) hoặc '' nếu hợp lệ.
export function validateStudent(form, { requireClass } = {}) {
  if (!String(form.full_name || '').trim()) return 'Vui lòng nhập họ tên học viên.';
  if (requireClass && !form.class_id) return 'Vui lòng chọn lớp. Giáo lý viên chỉ thêm hoặc sửa học viên trong lớp mình phụ trách.';
  for (const [k, label] of PHONE_FIELDS) {
    const v = String(form[k] || '').trim();
    if (v && !PHONE_RE.test(v)) return `${label} chưa đúng (chỉ gồm số, 8 đến 16 ký tự).`;
  }
  return '';
}

// Một nhóm thông tin có thể thu gọn
function Section({ title, hint, open, children }) {
  return (
    <details className="hvx-sec" open={open}>
      <summary><span>{title}</span>{hint && <small>{hint}</small>}</summary>
      <div className="hvx-sec-body">{children}</div>
    </details>
  );
}

// Form thông tin học viên dùng chung (Thêm/Sửa ở trang Học viên và Hồ sơ).
// classes: nếu truyền, hiện ô chọn lớp.
export default function StudentForm({ form, setForm, classes }) {
  const set = (k) => (e) => {
    const v = e.target.value;
    const next = { ...form, [k]: v };
    const need = SAC_BY_DATE[k];
    if (need && v && sacRank(next.sacrament) < sacRank(need)) next.sacrament = need;
    setForm(next);
  };
  const F = (k) => form[k] || '';
  const filled = (...ks) => ks.some((k) => String(form[k] || '').trim());
  const phoneBad = (k) => { const v = String(form[k] || '').trim(); return v && !PHONE_RE.test(v); };

  // ----- chứng chỉ/khóa: danh sách dòng {name, date} -----
  const certs = Array.isArray(form.certificates) ? form.certificates : [];
  const setCerts = (list) => setForm({ ...form, certificates: list });
  const addCert = () => setCerts([...certs, { name: '', date: '' }]);
  const updCert = (i, k, v) => setCerts(certs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const delCert = (i) => setCerts(certs.filter((_, idx) => idx !== i));

  const field = (k, label, props = {}) => (
    <div className={`field${props.span ? ' hvx-span' + props.span : ''}`}>
      <label>{label}</label>
      <input value={F(k)} onChange={set(k)} type={props.type || 'text'} placeholder={props.placeholder}
        inputMode={props.inputMode} className={props.phone && phoneBad(k) ? 'hvx-bad' : ''} autoFocus={props.autoFocus} />
      {props.phone && phoneBad(k) && <small className="hvx-err">Chỉ gồm số, 8 đến 16 ký tự</small>}
    </div>
  );

  return (
    <div className="hvx-form">
      <Section title="Thông tin chính" open>
        <div className="hvx-grid">
          {field('saint_name', 'Tên thánh')}
          {field('full_name', 'Họ tên *', { span: 2, autoFocus: !form.id })}
          {field('birth_date', 'Ngày sinh', { type: 'date' })}
          <div className="field"><label>Giới tính</label>
            <select value={F('gender')} onChange={set('gender')}><option value="">Chọn</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select>
          </div>
          {field('position', 'Chức vụ', { placeholder: 'VD: Lớp trưởng' })}
          {classes && (
            <div className="field hvx-span3"><label>Lớp</label>
              <select value={F('class_id')} onChange={set('class_id')}>
                <option value="">Chưa xếp lớp</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </Section>

      <Section title="Cha mẹ và người đỡ đầu" open>
        <div className="hvx-grid">
          {field('father_saint', 'Tên thánh cha')}
          {field('father_name', 'Họ tên cha')}
          {field('father_phone', 'SĐT cha', { inputMode: 'tel', phone: true })}
          {field('mother_saint', 'Tên thánh mẹ')}
          {field('mother_name', 'Họ tên mẹ')}
          {field('mother_phone', 'SĐT mẹ', { inputMode: 'tel', phone: true })}
          {field('godparent_name', 'Người đỡ đầu', { span: 2, placeholder: 'Họ tên người đỡ đầu' })}
          {field('student_phone', 'SĐT học viên', { inputMode: 'tel', phone: true })}
        </div>
      </Section>

      <Section title="Bí tích" hint="Nhập ngày lãnh nhận, trạng thái tự cập nhật theo" open>
        <div className="hvx-grid hvx-grid4">
          <div className="field"><label>Trạng thái</label>
            <select value={F('sacrament') || 'none'} onChange={set('sacrament')}>{SACRAMENT_OPTIONS.map((k) => <option key={k} value={k}>{SACRAMENTS[k].label}</option>)}</select>
          </div>
          {field('baptism_date', 'Ngày Rửa Tội', { type: 'date' })}
          {field('first_communion_date', 'Ngày Rước Lễ', { type: 'date' })}
          {field('confirmation_date', 'Ngày Thêm Sức', { type: 'date' })}
        </div>
      </Section>

      <Section title="Chi tiết in trên chứng chỉ Rửa Tội và Thêm Sức" hint="Chỉ cần khi in chứng chỉ"
        open={filled('birth_place', 'origin_place', 'residence', 'baptism_church', 'baptism_book_no', 'baptism_priest', 'confirmation_church', 'confirmation_bishop', 'confirmation_godparent', 'confirmation_book_no')}>
        <div className="hvx-grid">
          {field('birth_place', 'Nơi sinh')}
          {field('origin_place', 'Nguyên quán')}
          {field('residence', 'Trú quán')}
          {field('baptism_church', 'Nhà thờ Rửa Tội')}
          {field('baptism_book_no', 'Số trích sổ Rửa Tội')}
          {field('baptism_priest', 'Linh mục Rửa Tội')}
          {field('confirmation_church', 'Nhà thờ Thêm Sức')}
          {field('confirmation_bishop', 'Giám mục Thêm Sức')}
          {field('confirmation_godparent', 'Người đỡ đầu Thêm Sức')}
          {field('confirmation_book_no', 'Số trích sổ Thêm Sức')}
        </div>
      </Section>

      <Section title="Chứng chỉ, khóa đã hoàn thành" hint={certs.length ? `${certs.length} mục` : 'Không bắt buộc'} open={certs.length > 0}>
        <datalist id="cert-suggest">{CERT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        {certs.map((c, i) => (
          <div className="hvx-cert" key={i}>
            <div className="field"><label>Tên chứng chỉ</label>
              <input list="cert-suggest" value={c.name || ''} onChange={(e) => updCert(i, 'name', e.target.value)} placeholder="VD: Hoàn thành giáo lý hôn nhân" />
            </div>
            <div className="field"><label>Ngày</label><input type="date" value={c.date || ''} onChange={(e) => updCert(i, 'date', e.target.value)} /></div>
            <button type="button" className="hvx-del" onClick={() => delCert(i)} title="Bỏ dòng này" aria-label="Bỏ chứng chỉ này">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" onClick={addCert}>+ Thêm chứng chỉ</button>
      </Section>

      <Section title="Địa chỉ và ghi chú" open>
        <div className="field"><label>Địa chỉ</label><input value={F('address')} onChange={set('address')} /></div>
        <div className="field"><label>Ghi chú</label><textarea rows={2} value={F('notes')} onChange={set('notes')} /></div>
      </Section>
    </div>
  );
}
