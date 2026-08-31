import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { exportCertificates } from '../lib/certificate';

const TYPES = [
  { key: 'baptism', label: 'Rửa Tội' },
  { key: 'ruoc_le', label: 'Rước Lễ' },
  { key: 'them_suc', label: 'Thêm Sức' },
  { key: 'merit', label: 'Giấy khen' },
];

export default function Certificates() {
  const [parish, setParish] = useState(null);
  const [classes, setClasses] = useState([]);
  const [kind, setKind] = useState('them_suc');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');
  const [meritTitle, setMeritTitle] = useState('GIẤY KHEN');
  const [meritReason, setMeritReason] = useState('');

  useEffect(() => { api.get('/parish').then((r) => setParish(r.data)).catch(() => {}); }, []);
  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!classId) { setStudents([]); setPicked([]); return; }
    api.get(`/students?class_id=${classId}`).then((r) => { setStudents(r.data); setPicked(r.data.map((s) => s.id)); }).catch(() => {});
  }, [classId]);

  const cls = classes.find((c) => c.id === classId) || {};
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter((s) => !t || ((s.full_name || '') + ' ' + (s.saint_name || '')).toLowerCase().includes(t));
  }, [students, search]);
  const allPicked = students.length > 0 && students.every((s) => picked.includes(s.id));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(allPicked ? [] : students.map((s) => s.id));

  function issue() {
    const sel = students.filter((s) => picked.includes(s.id));
    if (!sel.length) { alert('Chưa chọn học viên nào'); return; }
    exportCertificates({
      parish, students: sel, kind,
      merit: kind === 'merit' ? { title: meritTitle, reason: meritReason, className: cls.name, year: cls.year } : undefined,
    });
  }

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>Cấp chứng chỉ / Giấy khen</h1>
      </div>

      <div className="panel">
        <div className="field" style={{ maxWidth: 420 }}>
          <label>Loại</label>
          <div className="seg">
            {TYPES.map((t) => <button key={t.key} type="button" className={`seg-btn ${kind === t.key ? 'on' : ''}`} onClick={() => setKind(t.key)}>{t.label}</button>)}
          </div>
        </div>

        {kind === 'merit' && (
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Tiêu đề</label><input value={meritTitle} onChange={(e) => setMeritTitle(e.target.value)} placeholder="GIẤY KHEN" /></div>
            <div className="field" style={{ flex: 2 }}><label>Nội dung khen</label><input value={meritReason} onChange={(e) => setMeritReason(e.target.value)} placeholder="VD: đạt thành tích xuất sắc trong học tập giáo lý" /></div>
          </div>
        )}

        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Lớp</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Tìm học viên</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên…" disabled={!classId} /></div>
        </div>

        {!classId ? (
          <p className="muted">Chọn lớp để hiện danh sách học viên; sau đó tick chọn (cả lớp / một số / từng em) rồi bấm Xuất.</p>
        ) : students.length === 0 ? (
          <p className="muted">Lớp chưa có học viên.</p>
        ) : (
          <>
            <div className="fp-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Đã chọn {picked.length}/{students.length}</span>
              <span className="link" onClick={toggleAll}>{allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
            </div>
            <div className="pick-list">
              {shown.map((s) => (
                <label key={s.id} className="fp-chk">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</span>
                </label>
              ))}
              {shown.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Không tìm thấy học viên.</div>}
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={issue} disabled={!picked.length}>🖨 Xuất {picked.length > 1 ? `${picked.length} tờ` : 'chứng chỉ'} (PDF)</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Chọn "Lưu thành PDF" (hoặc "Microsoft Print to PDF") trong hộp thoại in. Mỗi học viên một trang A4 ngang.</p>
        </div>
      </div>
    </div>
  );
}
