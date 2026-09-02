import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { exportCertificates } from '../lib/certificate';
import { printCert } from '../lib/certTemplates';

const TYPES = [
  { key: 'baptism', label: 'Rửa Tội & Thêm Sức (1)' },
  { key: 'baptism2', label: 'Rửa Tội & Thêm Sức (2)' },
  { key: 'marriage', label: 'Giáo Lý Hôn Nhân' },
  { key: 'scout', label: 'Huynh Trưởng' },
  { key: 'merit', label: 'Giấy khen' },
];
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function Certificates() {
  const [parish, setParish] = useState(null);
  const [currentClasses, setCurrentClasses] = useState([]);
  const [currentYear, setCurrentYear] = useState('');
  const [archYears, setArchYears] = useState([]);
  const [year, setYear] = useState('');
  const [classes, setClasses] = useState([]);
  const [kind, setKind] = useState('baptism');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');
  const [meritTitle, setMeritTitle] = useState('GIẤY KHEN');
  const [meritReason, setMeritReason] = useState('');
  // thông tin in trên chứng chỉ thiết kế
  const [priestName, setPriestName] = useState('');
  const [extra, setExtra] = useState({ place: '', issue_date: todayStr(), role: 'Anh', level: 'I' });
  const setE = (k) => (e) => setExtra((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    api.get('/parish').then((r) => {
      setParish(r.data);
      setExtra((x) => ({ ...x, place: x.place || r.data?.name || '' }));
      setPriestName((p) => p || r.data?.settings?.priest_name || '');
    }).catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      api.get('/classes').then((r) => r.data).catch(() => []),
      api.get('/archive-years').then((r) => r.data).catch(() => []),
    ]).then(([cur, ay]) => {
      const cy = cur.map((c) => c.year).find(Boolean) || '';
      setCurrentClasses(cur); setCurrentYear(cy); setArchYears(ay || []);
      setYear(cy || (ay?.[0]?.year || ''));
    });
  }, []);

  const isCurrentYear = !!year && year === currentYear;
  useEffect(() => {
    setClassId(''); setStudents([]); setPicked([]);
    if (!year) { setClasses([]); return; }
    if (year === currentYear) { setClasses(currentClasses); return; }
    api.get(`/archive-classes?year=${encodeURIComponent(year)}`).then((r) => setClasses(r.data)).catch(() => setClasses([]));
  }, [year, currentYear, currentClasses]);
  useEffect(() => {
    if (!classId) { setStudents([]); setPicked([]); return; }
    const req = isCurrentYear
      ? api.get(`/students?class_id=${classId}`).then((r) => r.data)
      : api.get(`/archive-class?class_id=${classId}`).then((r) => r.data.students || []);
    req.then((list) => { setStudents(list); setPicked(list.map((s) => s.id)); }).catch(() => {});
  }, [classId, isCurrentYear]);

  const yearOptions = useMemo(() => [
    ...(currentYear ? [{ value: currentYear, label: `${currentYear} (hiện tại)` }] : []),
    ...(archYears || []).filter((a) => a.year && a.year !== currentYear).map((a) => ({ value: a.year, label: a.year })),
  ], [currentYear, archYears]);

  const cls = classes.find((c) => c.id === classId) || {};
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter((s) => !t || ((s.full_name || '') + ' ' + (s.saint_name || '')).toLowerCase().includes(t));
  }, [students, search]);
  const allPicked = students.length > 0 && students.every((s) => picked.includes(s.id));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(allPicked ? [] : students.map((s) => s.id));
  const isMerit = kind === 'merit';

  function issue() {
    const sel = students.filter((s) => picked.includes(s.id));
    if (!sel.length) { alert('Chưa chọn học viên nào'); return; }
    if (isMerit) {
      exportCertificates({ parish, students: sel, kind: 'merit', merit: { title: meritTitle, reason: meritReason, className: cls.name, year: cls.year } });
      return;
    }
    const parishForCert = { ...parish, priest_name: priestName, priest_signature: parish?.settings?.priest_signature };
    printCert({ template: kind, parish: parishForCert, students: sel, extra });
  }

  return (
    <div>
      <div className="att-head"><h1 style={{ margin: 0 }}>Cấp chứng chỉ / Giấy khen</h1></div>

      <div className="panel">
        <div className="field">
          <label>Loại chứng chỉ</label>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {TYPES.map((t) => <button key={t.key} type="button" className={`seg-btn ${kind === t.key ? 'on' : ''}`} onClick={() => setKind(t.key)}>{t.label}</button>)}
          </div>
        </div>

        {isMerit ? (
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Tiêu đề</label><input value={meritTitle} onChange={(e) => setMeritTitle(e.target.value)} placeholder="GIẤY KHEN" /></div>
            <div className="field" style={{ flex: 2 }}><label>Nội dung khen</label><input value={meritReason} onChange={(e) => setMeritReason(e.target.value)} placeholder="VD: đạt thành tích xuất sắc trong học tập giáo lý" /></div>
          </div>
        ) : (
          <>
            <div className="row">
              <div className="field" style={{ flex: 1 }}><label>Người ký (Linh mục / Trưởng ban)</label><input value={priestName} onChange={(e) => setPriestName(e.target.value)} placeholder="VD: Phêrô Nguyễn Văn An" /></div>
              <div className="field" style={{ flex: 1 }}><label>Nơi cấp</label><input value={extra.place} onChange={setE('place')} placeholder="VD: Hòa Khánh" /></div>
              <div className="field" style={{ flex: '0 0 160px' }}><label>Ngày cấp</label><input type="date" value={extra.issue_date} onChange={setE('issue_date')} /></div>
            </div>
            {kind === 'marriage' && (
              <div className="row">
                <div className="field" style={{ flex: '0 0 120px' }}><label>Vai</label><select value={extra.role} onChange={setE('role')}><option>Anh</option><option>Chị</option></select></div>
                <div className="field" style={{ flex: 2 }}><label>Dòng chứng nhận</label><input value={extra.certify_line || ''} onChange={setE('certify_line')} placeholder="VD: Linh mục Giáo xứ Nam Tây chứng nhận" /></div>
              </div>
            )}
            {kind === 'scout' && (
              <>
                <div className="row">
                  <div className="field" style={{ flex: 2 }}><label>Ban tổ chức</label><input value={extra.org2 || ''} onChange={setE('org2')} placeholder="Ban Giáo lý & Mục vụ Thiếu nhi" /></div>
                  <div className="field" style={{ flex: 1 }}><label>Giáo họ</label><input value={extra.giao_ho || ''} onChange={setE('giao_ho')} /></div>
                </div>
                <div className="row">
                  <div className="field" style={{ flex: 2 }}><label>Sa mạc tại</label><input value={extra.samac || ''} onChange={setE('samac')} placeholder="Tên/địa điểm sa mạc" /></div>
                  <div className="field" style={{ flex: '0 0 90px' }}><label>Cấp</label><input value={extra.level} onChange={setE('level')} placeholder="I" /></div>
                  <div className="field" style={{ flex: '0 0 160px' }}><label>Ngày khai mạc</label><input type="date" value={extra.open_date || ''} onChange={setE('open_date')} /></div>
                  <div className="field" style={{ flex: '0 0 120px' }}><label>Vào sổ số</label><input value={extra.sono || ''} onChange={setE('sono')} /></div>
                </div>
              </>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: -2 }}>
              Mọi thông tin (tên, ngày sinh, cha mẹ, nơi sinh, nhà thờ, số trích sổ, ngày rửa tội/thêm sức…) lấy từ <b>hồ sơ học viên</b> — nhập ở Học viên → hồ sơ → mục "Chi tiết cho chứng chỉ". Người ký &amp; chữ ký lấy từ Cài đặt giáo xứ.
            </p>
          </>
        )}

        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Niên khóa</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.length === 0 && <option value="">— Chưa có —</option>}
              {yearOptions.map((y) => <option key={y.value} value={y.value}>Niên khóa {y.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Lớp</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!classes.length}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Tìm học viên</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên…" disabled={!classId} /></div>
        </div>

        {!classId ? (
          <p className="muted">Chọn niên khóa &amp; lớp để hiện danh sách học viên; sau đó tick chọn rồi bấm Xuất.</p>
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
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Chọn "Lưu thành PDF" trong hộp thoại in. Mỗi học viên một trang.</p>
        </div>
      </div>
    </div>
  );
}
