import { SACRAMENTS, SACRAMENT_OPTIONS, CERT_SUGGESTIONS } from './SacramentBadge.jsx';

// Form thông tin học viên dùng chung (Thêm/Sửa ở trang Học viên và Hồ sơ).
// classes: nếu truyền, hiện ô chọn lớp.
export default function StudentForm({ form, setForm, classes }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const F = (k) => form[k] || '';

  // ----- chứng chỉ/khóa: danh sách dòng {name, date} -----
  const certs = Array.isArray(form.certificates) ? form.certificates : [];
  const setCerts = (list) => setForm({ ...form, certificates: list });
  const addCert = () => setCerts([...certs, { name: '', date: '' }]);
  const updCert = (i, k, v) => setCerts(certs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const delCert = (i) => setCerts(certs.filter((_, idx) => idx !== i));

  return (
    <>
      <div className="row">
        <div className="field"><label>Tên thánh</label><input value={F('saint_name')} onChange={set('saint_name')} /></div>
        <div className="field"><label>Họ tên *</label><input value={F('full_name')} onChange={set('full_name')} /></div>
      </div>
      <div className="row">
        <div className="field"><label>Ngày sinh</label><input type="date" value={F('birth_date')} onChange={set('birth_date')} /></div>
        <div className="field"><label>Giới tính</label><select value={F('gender')} onChange={set('gender')}><option value="">—</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></div>
        <div className="field"><label>Chức vụ</label><input value={F('position')} onChange={set('position')} placeholder="VD: Lớp trưởng" /></div>
      </div>
      {classes && (
        <div className="field"><label>Lớp</label>
          <select value={F('class_id')} onChange={set('class_id')}>
            <option value="">Chưa xếp lớp</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="form-section">Thông tin cha</div>
      <div className="row">
        <div className="field"><label>Tên thánh cha</label><input value={F('father_saint')} onChange={set('father_saint')} /></div>
        <div className="field"><label>Họ tên cha</label><input value={F('father_name')} onChange={set('father_name')} /></div>
        <div className="field"><label>SĐT cha</label><input value={F('father_phone')} onChange={set('father_phone')} /></div>
      </div>

      <div className="form-section">Thông tin mẹ</div>
      <div className="row">
        <div className="field"><label>Tên thánh mẹ</label><input value={F('mother_saint')} onChange={set('mother_saint')} /></div>
        <div className="field"><label>Họ tên mẹ</label><input value={F('mother_name')} onChange={set('mother_name')} /></div>
        <div className="field"><label>SĐT mẹ</label><input value={F('mother_phone')} onChange={set('mother_phone')} /></div>
      </div>

      <div className="row">
        <div className="field"><label>Người đỡ đầu</label><input value={F('godparent_name')} onChange={set('godparent_name')} placeholder="Họ tên người đỡ đầu" /></div>
        <div className="field"><label>SĐT học sinh</label><input value={F('student_phone')} onChange={set('student_phone')} /></div>
      </div>

      <div className="form-section">Bí tích</div>
      <div className="row">
        <div className="field"><label>Trạng thái</label><select value={F('sacrament') || 'none'} onChange={set('sacrament')}>{SACRAMENT_OPTIONS.map((k) => <option key={k} value={k}>{SACRAMENTS[k].label}</option>)}</select></div>
        <div className="field"><label>Ngày rửa tội</label><input type="date" value={F('baptism_date')} onChange={set('baptism_date')} /></div>
        <div className="field"><label>Ngày rước lễ</label><input type="date" value={F('first_communion_date')} onChange={set('first_communion_date')} /></div>
        <div className="field"><label>Ngày thêm sức</label><input type="date" value={F('confirmation_date')} onChange={set('confirmation_date')} /></div>
      </div>

      <div className="form-section">Chứng chỉ / khóa hoàn thành</div>
      <datalist id="cert-suggest">{CERT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      {certs.map((c, i) => (
        <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2 }}><label>Tên chứng chỉ</label>
            <input list="cert-suggest" value={c.name || ''} onChange={(e) => updCert(i, 'name', e.target.value)} placeholder="VD: Hoàn thành giáo lý hôn nhân" />
          </div>
          <div className="field"><label>Ngày</label><input type="date" value={c.date || ''} onChange={(e) => updCert(i, 'date', e.target.value)} /></div>
          <button type="button" className="btn danger sm" style={{ marginBottom: 2 }} onClick={() => delCert(i)}>Xóa</button>
        </div>
      ))}
      <button type="button" className="btn ghost sm" onClick={addCert}>+ Thêm chứng chỉ</button>

      <div className="field" style={{ marginTop: 12 }}><label>Địa chỉ</label><input value={F('address')} onChange={set('address')} /></div>
      <div className="field"><label>Ghi chú</label><textarea rows={2} value={F('notes')} onChange={set('notes')} /></div>
    </>
  );
}
