import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import SacramentBadge, { SACRAMENTS, SACRAMENT_OPTIONS } from '../components/SacramentBadge.jsx';
import { IconEditImage } from '../components/Icons.jsx';
import { fileToDataUrl } from '../lib/img';
import { ATT_LABEL } from '../lib/exportUtils';

const initials = (name = '') => { const p = name.trim().split(/\s+/); return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?'; };
const ATT_TONE = { present: 'ic-present', absent: 'ic-absent', late: 'ic-late', excused: 'ic-excused' };
const ATT_CHAR = { present: '✓', absent: '✗', late: '⏱', excused: 'P' };

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'teacher';
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function onPickAvatar(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await fileToDataUrl(file, 240); await api.put(`/students/${id}`, { avatar_url: url }); load(); }
    catch { /* noop */ } finally { setUploading(false); }
  }

  function load() {
    api.get(`/student-profile?id=${id}`).then((r) => setData(r.data)).catch((e) => setErr(e.response?.data?.error || 'Không tải được hồ sơ'));
  }
  useEffect(() => { load(); }, [id]);

  if (err) return <div><button className="btn ghost sm" onClick={() => navigate(-1)}>← Quay lại</button><p className="muted" style={{ marginTop: 12 }}>{err}</p></div>;
  if (!data) return <div className="muted">Đang tải...</div>;

  const s = data.student;
  const info = [
    ['Ngày sinh', s.birth_date || '—'],
    ['Giới tính', s.gender || '—'],
    ['Tên phụ huynh', s.parent_name || '—'],
    ['SĐT phụ huynh', s.parent_phone || '—'],
    ['SĐT học sinh', s.student_phone || '—'],
    ['Địa chỉ', s.address || '—'],
  ];

  async function save() {
    try { await api.put(`/students/${id}`, edit); setEdit(null); load(); }
    catch (e) { alert(e.response?.data?.error || 'Lưu thất bại'); }
  }
  const setF = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <div>
      <button className="btn ghost sm" onClick={() => navigate(-1)}>← Quay lại</button>

      {/* Thẻ đầu hồ sơ */}
      <div className="panel profile-head">
        <div className="profile-ava-wrap">
          {s.avatar_url ? <img className="profile-ava-img" src={s.avatar_url} alt="avatar" /> : <div className="profile-ava">{initials(s.full_name)}</div>}
          {canEdit && (
            <>
              <button className="ava-edit" title="Đổi ảnh học viên" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '…' : <IconEditImage width="14" height="14" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: 'none' }} />
            </>
          )}
        </div>
        <div className="profile-id">
          <div className="profile-name">{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name} <SacramentBadge value={s.sacrament} /></div>
          <div className="profile-tags">
            <span className="tag-chip">{s.class_name || 'Chưa xếp lớp'}</span>
            {s.position && <span className="tag-chip role">{s.position}</span>}
            <span className="tag-chip muted">{SACRAMENTS[s.sacrament]?.label || 'Chưa nhận bí tích'}</span>
          </div>
        </div>
        {canEdit && <button className="btn" onClick={() => setEdit({ ...s })}>✏ Sửa thông tin</button>}
      </div>

      {/* Chỉ số nhanh */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-mini"><div className="lbl">Điểm trung bình</div><div className="num">{data.tb ?? '—'}</div></div>
        <div className="stat-mini"><div className="lbl">Chuyên cần</div><div className="num">{data.attendance.rate != null ? data.attendance.rate + '%' : '—'}</div></div>
        <div className="stat-mini"><div className="lbl">Có mặt / Vắng KP / Trễ / Phép</div><div className="num" style={{ fontSize: 16 }}>{data.attendance.present} / {data.attendance.absent} / {data.attendance.late} / {data.attendance.excused}</div></div>
        <div className="stat-mini"><div className="lbl">Buổi đã điểm danh</div><div className="num">{data.attendance.total}</div></div>
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          {/* Thông tin cá nhân */}
          <div className="panel">
            <div className="card-head"><h2>Thông tin cá nhân</h2></div>
            <div className="info-grid">
              {info.map(([k, v]) => (<div className="info-row" key={k}><span className="info-k">{k}</span><span className="info-v">{v}</span></div>))}
            </div>
            {s.notes && <div className="info-row" style={{ marginTop: 8 }}><span className="info-k">Ghi chú</span><span className="info-v">{s.notes}</span></div>}
          </div>

          {/* Bảng điểm */}
          <div className="panel">
            <div className="card-head"><h2>Điểm số</h2>{s.class_id && <span className="link" onClick={() => navigate(`/grades?class=${s.class_id}`)}>Bảng điểm lớp</span>}</div>
            <table>
              <thead><tr><th>Cột điểm</th><th style={{ textAlign: 'center' }}>Hệ số</th><th style={{ textAlign: 'right' }}>Điểm</th></tr></thead>
              <tbody>
                {data.grades.map((g, i) => (<tr key={i}><td>{g.name}</td><td style={{ textAlign: 'center' }}>{g.weight}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{g.score}</td></tr>))}
                {data.grades.length === 0 && <tr><td colSpan={3} className="muted">Chưa có điểm</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-col">
          {/* Việc thiêng liêng */}
          <div className="panel">
            <div className="card-head"><h2>Việc thiêng liêng</h2></div>
            <table>
              <tbody>
                {data.spiritual.map((t) => (<tr key={t.task}><td>{t.task}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{t.done}/{t.total}</td></tr>))}
                {data.spiritual.length === 0 && <tr><td className="muted">Chưa có ghi nhận</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Điểm danh gần đây */}
          <div className="panel">
            <div className="card-head"><h2>Điểm danh gần đây</h2></div>
            <div className="att-recent">
              {data.attendance.recent.map((a, i) => (
                <div className="att-recent-row" key={i} title={(ATT_LABEL[a.status] || '') + (a.note ? ' — ' + a.note : '')}>
                  <span>{a.date.split('-').reverse().join('/')}</span>
                  <span className={`att-ic ${ATT_TONE[a.status]}`}>{ATT_CHAR[a.status] || '?'}</span>
                </div>
              ))}
              {data.attendance.recent.length === 0 && <div className="muted">Chưa có buổi điểm danh</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal sửa thông tin */}
      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sửa thông tin học viên</h2>
            <div className="row">
              <div className="field"><label>Tên thánh</label><input value={edit.saint_name || ''} onChange={setF('saint_name')} /></div>
              <div className="field"><label>Họ tên *</label><input value={edit.full_name || ''} onChange={setF('full_name')} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Ngày sinh</label><input type="date" value={edit.birth_date || ''} onChange={setF('birth_date')} /></div>
              <div className="field"><label>Giới tính</label><select value={edit.gender || ''} onChange={setF('gender')}><option value="">—</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></div>
              <div className="field"><label>Bí tích</label><select value={edit.sacrament || 'none'} onChange={setF('sacrament')}>{SACRAMENT_OPTIONS.map((k) => <option key={k} value={k}>{SACRAMENTS[k].label}</option>)}</select></div>
            </div>
            <div className="row">
              <div className="field"><label>Chức vụ</label><input value={edit.position || ''} onChange={setF('position')} placeholder="VD: Lớp trưởng" /></div>
              <div className="field"><label>Tên phụ huynh</label><input value={edit.parent_name || ''} onChange={setF('parent_name')} /></div>
            </div>
            <div className="row">
              <div className="field"><label>SĐT phụ huynh</label><input value={edit.parent_phone || ''} onChange={setF('parent_phone')} /></div>
              <div className="field"><label>SĐT học sinh</label><input value={edit.student_phone || ''} onChange={setF('student_phone')} /></div>
            </div>
            <div className="field"><label>Địa chỉ</label><input value={edit.address || ''} onChange={setF('address')} /></div>
            <div className="field"><label>Ghi chú</label><textarea rows={2} value={edit.notes || ''} onChange={setF('notes')} /></div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEdit(null)}>Hủy</button>
              <button className="btn" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
