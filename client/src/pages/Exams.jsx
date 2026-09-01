import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import QRCode from 'qrcode';
import { exportXlsx, fileSlug } from '../lib/exportUtils';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const KINDS = [{ v: '15p', l: '15 phút' }, { v: '1tiet', l: '1 tiết' }, { v: 'hocky', l: 'Học kỳ' }, { v: 'khac', l: 'Khác' }];
const kindLabel = (k) => (KINDS.find((x) => x.v === k) || { l: k }).l;
const EXAM_BASE = (typeof window !== 'undefined' ? window.location.origin : '') + '/exam/';
const ST = {
  draft: ['Nháp', '#e5e7eb', '#374151'], waiting: ['Phòng chờ', '#fef9c3', '#854d0e'],
  started: ['Đang thi', '#dcfce7', '#15803d'], closed: ['Đã đóng', '#e0e7ff', '#3730a3'],
};
function badge(s) { const v = ST[s] || ST.draft; return <span className="tag-chip" style={{ background: v[1], color: v[2] }}>{v[0]}</span>; }

export default function Exams() {
  const [view, setView] = useState('list'); // list | build | room
  const [exams, setExams] = useState([]);
  const [current, setCurrent] = useState(null);
  const [classes, setClasses] = useState([]);
  function load() { api.get('/exams').then((r) => setExams(r.data)).catch(() => setExams([])); }
  useEffect(() => { load(); api.get('/classes').then((r) => setClasses(r.data)).catch(() => {}); }, []);
  async function del(e) { if (!confirm(`Xoá đề "${e.title}"? Mất luôn các bài đã nộp.`)) return; await api.delete(`/exams/${e.id}`); load(); }

  if (view === 'build') return <ExamBuilder classes={classes} onCancel={() => setView('list')} onDone={(id) => { load(); setCurrent(id); setView('room'); }} />;
  if (view === 'room' && current) return <ExamRoom examId={current} onBack={() => { load(); setCurrent(null); setView('list'); }} />;

  return (
    <div>
      <div className="att-head"><h1 style={{ margin: 0 }}>Đề thi &amp; thi online</h1>
        <button className="btn" onClick={() => setView('build')}>+ Tạo đề</button></div>
      <div className="panel">
        {exams.length === 0 ? <p className="muted">Chưa có đề thi nào. Bấm "Tạo đề" để soạn đề trắc nghiệm cho học viên thi online.</p> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Đề</th><th>Lớp</th><th>Loại (hệ số)</th><th>Câu</th><th>Trạng thái</th><th>Nộp</th><th></th></tr></thead>
            <tbody>{exams.map((e) => (
              <tr key={e.id}>
                <td><span className="link-name" onClick={() => { setCurrent(e.id); setView('room'); }}>{e.title}</span></td>
                <td className="muted">{e.class_name || '—'}</td>
                <td>{kindLabel(e.kind)} (×{e.weight})</td>
                <td>{e.num_questions}</td>
                <td>{badge(e.status)}</td>
                <td>{e.submitted}/{e.joined}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => { setCurrent(e.id); setView('room'); }}>Phòng thi</button>{' '}
                  <button className="btn danger sm" onClick={() => del(e)}>Xoá</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Soạn đề ---------------- */
function ExamBuilder({ classes, onDone, onCancel }) {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [kind, setKind] = useState('15p');
  const [weight, setWeight] = useState(1);
  const [duration, setDuration] = useState(15);
  const [bank, setBank] = useState(null);      // { topics: [...] }
  const [topicId, setTopicId] = useState('');
  const [n, setN] = useState(10);
  const [picked, setPicked] = useState({});    // qid -> question
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/exam-question-bank.json').then((r) => r.json()).then((b) => {
      setBank(b); setTopicId(b.topics?.[0]?.id || '');
    }).catch(() => setBank({ topics: [] }));
  }, []);

  const topic = bank?.topics?.find((t) => t.id === topicId);
  const pickedList = Object.values(picked);
  const isPicked = (q) => !!picked[q.id];
  function toggle(q) { setPicked((p) => { const c = { ...p }; if (c[q.id]) delete c[q.id]; else c[q.id] = { ...q, _topic: topicId }; return c; }); }
  function pickRandom() {
    if (!topic) return;
    const pool = topic.questions.filter((q) => !picked[q.id]);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const add = pool.slice(0, Math.max(0, Number(n) || 0));
    setPicked((p) => { const c = { ...p }; add.forEach((q) => { c[q.id] = { ...q, _topic: topicId }; }); return c; });
  }
  function clearTopic() { setPicked((p) => { const c = { ...p }; (topic?.questions || []).forEach((q) => delete c[q.id]); return c; }); }

  async function save() {
    setErr('');
    if (!title.trim()) return setErr('Nhập tên đề thi');
    if (!classId) return setErr('Chọn lớp thi');
    if (!pickedList.length) return setErr('Chọn ít nhất 1 câu hỏi');
    setSaving(true);
    try {
      const questions = pickedList.map((q) => ({ text: q.text, options: q.options, correct: q.correct }));
      const { data } = await api.post('/exams', { title: title.trim(), class_id: classId, kind, weight: Number(weight) || 1, duration_min: Number(duration) || null, questions });
      onDone(data.id);
    } catch (e) { setErr(e.response?.data?.error || 'Tạo đề thất bại'); setSaving(false); }
  }

  return (
    <div>
      <div className="att-head"><h1 style={{ margin: 0 }}>Soạn đề thi</h1>
        <button className="btn ghost" onClick={onCancel}>← Quay lại</button></div>

      <div className="panel">
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label>Tên đề *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Kiểm tra 15 phút — Bài 5" /></div>
          <div className="field" style={{ flex: 1 }}><label>Lớp thi *</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label>Loại bài</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
          </div>
          <div className="field" style={{ flex: 1 }}><label>Hệ số điểm</label>
            <input type="number" min="1" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}><label>Thời lượng (phút, 0 = không giới hạn)</label>
            <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="card-head"><h2 style={{ margin: 0 }}>Chọn câu hỏi</h2>
          <span className="muted" style={{ fontSize: 13 }}>Đã chọn <b>{pickedList.length}</b> câu</span></div>
        {!bank ? <p className="muted">Đang tải ngân hàng câu hỏi…</p> : (
          <>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}><label>Ngân hàng (theo cấp)</label>
                <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  {bank.topics.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.count} câu)</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: '0 0 110px' }}><label>Số câu bốc</label><input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} /></div>
              <div className="field" style={{ flex: '0 0 auto' }}><button className="btn ghost" onClick={pickRandom}>🎲 Bốc ngẫu nhiên</button></div>
              <div className="field" style={{ flex: '0 0 auto' }}><button className="btn ghost" onClick={clearTopic}>Bỏ chọn cấp này</button></div>
            </div>
            <div className="pick-list" style={{ maxHeight: 340 }}>
              {(topic?.questions || []).map((q) => (
                <label key={q.id} className="fp-chk" style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={isPicked(q)} onChange={() => toggle(q)} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 13.5 }}>{q.text}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {err && <div className="error">{err}</div>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel}>Huỷ</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Đang tạo…' : `Tạo đề (${pickedList.length} câu)`}</button>
      </div>
    </div>
  );
}

/* ---------------- Phòng thi (điều khiển + QR + kết quả) ---------------- */
function ExamRoom({ examId, onBack }) {
  const [exam, setExam] = useState(null);
  const [qr, setQr] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [reviewing, setReviewing] = useState(null); // attempt đang xem lại
  const pollRef = useRef(null);

  function exportResults() {
    const qs = exam.questions || [];
    const rows = (exam.attempts || []).filter((a) => a.status === 'submitted');
    const columns = [
      { label: 'STT', get: (_r, i) => i + 1, width: 6 },
      { label: 'Họ tên', get: (r) => r.student_name, width: 26 },
      { label: 'Điểm', get: (r) => (r.score ?? ''), width: 8 },
      { label: 'Số câu đúng', get: (r) => (r.correct_count ?? ''), width: 11 },
      { label: 'Tổng câu', get: (r) => (r.total ?? ''), width: 9 },
      { label: 'Nộp lúc', get: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString('vi-VN') : ''), width: 19 },
      ...qs.map((q, qi) => ({ label: 'C' + (qi + 1), get: (r) => { const c = r.answers?.[q.id]; return c == null ? '—' : (c === q.correct ? 'Đ' : 'S'); }, width: 5 })),
    ];
    exportXlsx({
      filename: `ket-qua-${fileSlug(exam.title)}.xlsx`, sheetName: 'Kết quả',
      title: 'KẾT QUẢ THI: ' + exam.title,
      subtitle: [`Lớp: ${exam.class_name || ''}`, `${kindLabel(exam.kind)} — hệ số ${exam.weight} — ${qs.length} câu`, 'Đ = đúng · S = sai · — = bỏ trống'],
      columns, rows,
    });
  }

  function load() { return api.get(`/exams/${examId}`).then((r) => setExam(r.data)).catch(() => {}); }
  useEffect(() => { load(); }, [examId]);
  useEffect(() => {
    if (exam?.code) QRCode.toDataURL(EXAM_BASE + exam.code, { width: 240, margin: 1 }).then(setQr).catch(() => {});
  }, [exam?.code]);
  // Poll bài làm khi phòng đang mở
  useEffect(() => {
    if (!exam) return;
    if (exam.status === 'waiting' || exam.status === 'started') {
      pollRef.current = setInterval(load, 3000);
      return () => clearInterval(pollRef.current);
    }
  }, [exam?.status]); // eslint-disable-line

  async function setStatus(status) { await api.post(`/exams/${examId}/status`, { status }); load(); }
  async function saveGrades() {
    try { const { data } = await api.post(`/exams/${examId}/save-grades`, {}); setSavedMsg(`Đã lưu ${data.saved} điểm vào bảng điểm lớp.`); }
    catch (e) { alert(e.response?.data?.error || 'Lưu điểm thất bại'); }
  }
  if (!exam) return <div className="muted">Đang tải…</div>;

  const link = EXAM_BASE + exam.code;
  const attempts = exam.attempts || [];
  const submitted = attempts.filter((a) => a.status === 'submitted');

  return (
    <div>
      <div className="att-head">
        <h1 style={{ margin: 0 }}>{exam.title} {badge(exam.status)}</h1>
        <button className="btn ghost" onClick={onBack}>← Danh sách đề</button>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>Lớp: <b>{exam.class_name || '—'}</b> · {kindLabel(exam.kind)} (×{exam.weight}) · {exam.questions?.length || 0} câu · {exam.duration_min ? `${exam.duration_min} phút` : 'không giới hạn giờ'}</p>

      <div className="dash-grid">
        <div className="dash-col">
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="card-head" style={{ justifyContent: 'center' }}><h2 style={{ margin: 0 }}>Mã dự thi</h2></div>
            {qr && (exam.status === 'waiting' || exam.status === 'started')
              ? <img src={qr} alt="QR" style={{ width: 220, height: 220 }} />
              : <div className="muted" style={{ padding: 30 }}>QR hiện khi mở phòng chờ</div>}
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, margin: '6px 0' }}>{exam.code}</div>
            <div className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{link}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {exam.status === 'draft' && <button className="btn" onClick={() => setStatus('waiting')}>Mở phòng chờ</button>}
              {exam.status === 'waiting' && <button className="btn" onClick={() => setStatus('started')}>▶ Bắt đầu thi</button>}
              {exam.status === 'started' && <button className="btn danger" onClick={() => { if (confirm('Kết thúc & đóng phòng thi?')) setStatus('closed'); }}>■ Kết thúc</button>}
              {exam.status === 'closed' && <button className="btn" onClick={() => setStatus('started')}>↻ Mở thi lại (cho em vắng)</button>}
            </div>
            {exam.status === 'waiting' && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Các em quét QR, chọn tên và chờ. Bấm "Bắt đầu thi" khi đủ.</p>}
            {exam.status === 'closed' && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Bấm "Mở thi lại" để em vắng buổi thi vào làm; điểm sẽ được gộp vào cùng cột điểm cũ.</p>}
          </div>
        </div>

        <div className="dash-col">
          <div className="panel">
            <div className="card-head"><h2 style={{ margin: 0 }}>Học viên ({attempts.length})</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 13 }}>Đã nộp {submitted.length}</span>
                {submitted.length > 0 && <button className="btn ghost sm" onClick={exportResults}>⬇ Excel</button>}
              </div>
            </div>
            <div className="table-scroll" style={{ maxHeight: 320 }}><table>
              <thead><tr><th>Tên</th><th>Trạng thái</th><th>Điểm</th></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className={a.status === 'submitted' ? 'click-row' : ''} onClick={() => a.status === 'submitted' && setReviewing(a)}>
                    <td>{a.student_name}{a.status === 'submitted' && <span className="muted" style={{ fontSize: 11 }}> · xem lại</span>}</td>
                    <td>{a.status === 'submitted' ? <span className="tag-chip" style={{ background: '#dcfce7', color: '#15803d' }}>Đã nộp</span> : <span className="muted">Đang làm</span>}</td>
                    <td style={{ fontWeight: 600 }}>{a.score != null ? a.score : '—'}{a.total ? <span className="muted" style={{ fontSize: 12 }}> ({a.correct_count}/{a.total})</span> : ''}</td>
                  </tr>
                ))}
                {attempts.length === 0 && <tr><td colSpan={3} className="muted">Chưa có em nào vào.</td></tr>}
              </tbody>
            </table></div>
            {submitted.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={saveGrades}>💾 Lưu {submitted.length} điểm vào bảng điểm lớp</button>
                {savedMsg && <div className="info-box" style={{ marginTop: 8 }}>{savedMsg}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewing && (
        <div className="modal-backdrop" onClick={() => setReviewing(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="card-head"><h2 style={{ margin: 0 }}>Bài làm — {reviewing.student_name}</h2>
              <span className="muted">{reviewing.score}/10 · đúng {reviewing.correct_count}/{reviewing.total}</span></div>
            <div className="pick-list" style={{ maxHeight: '62vh' }}>
              {(exam.questions || []).map((q, i) => {
                const chosen = reviewing.answers?.[q.id];
                const right = chosen === q.correct;
                return (
                  <div className="rv-q" key={q.id}>
                    <div className="rv-q-t"><b>Câu {i + 1}.</b> {q.text} {chosen == null ? <span className="muted">(bỏ trống)</span> : right ? <span style={{ color: '#15803d' }}>✓</span> : <span style={{ color: '#dc2626' }}>✗</span>}</div>
                    {(q.options || []).map((opt, idx) => (
                      <div key={idx} className={`rv-opt ${idx === q.correct ? 'correct' : ''} ${idx === chosen && !right ? 'wrong' : ''}`}>
                        <b>{LETTERS[idx]}.</b> {opt}
                        {idx === q.correct && <span className="rv-tag ok"> đáp án đúng</span>}
                        {idx === chosen && <span className="muted"> ← em chọn</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={() => setReviewing(null)}>Đóng</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
