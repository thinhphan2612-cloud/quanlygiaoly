import { useEffect, useRef, useState } from 'react';
import api from '../api';

const COLORS = ['#2563eb', '#f59e0b', '#15803d', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#0ea5e9', '#e0a800', '#16a34a'];
const initials = (name = '') => { const p = name.trim().split(/\s+/); return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?'; };

export default function RandomPicker() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState(null);
  const [racing, setRacing] = useState(false);
  const [noRepeat, setNoRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState({});
  const timer = useRef(null);
  const progRef = useRef({});

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);
  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    api.get(`/students?class_id=${classId}`).then((r) => setStudents(r.data));
    setPickedIds([]); setPicked(null); setNote(''); setProgress({});
  }, [classId]);
  useEffect(() => () => clearInterval(timer.current), []);

  const pool = noRepeat ? students.filter((s) => !pickedIds.includes(s.id)) : students;

  function start() {
    if (racing) return;
    if (pool.length === 0) { setNote(noRepeat ? 'Đã chọn hết học viên trong lớp!' : 'Lớp chưa có học viên'); return; }
    setPicked(null); setNote('');
    const runners = pool.slice();
    const winner = runners[Math.floor(Math.random() * runners.length)];
    progRef.current = Object.fromEntries(runners.map((s) => [s.id, 0]));
    setProgress({ ...progRef.current });
    setRacing(true);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const p = progRef.current;
      runners.forEach((s) => {
        const step = Math.random() * 3.2 + (s.id === winner.id ? 1.1 : 0);
        p[s.id] = Math.min(100, p[s.id] + step);
      });
      if (p[winner.id] < 100) {
        // giữ các bạn khác chưa về đích để người thắng cán đích trước
        runners.forEach((s) => { if (s.id !== winner.id) p[s.id] = Math.min(p[s.id], 94); });
      } else {
        clearInterval(timer.current);
        setProgress({ ...p });
        setRacing(false);
        setPicked(winner);
        setPickedIds((ids) => [...ids, winner.id]);
        return;
      }
      setProgress({ ...p });
    }, 90);
  }

  function reset() {
    clearInterval(timer.current);
    setRacing(false); setPickedIds([]); setPicked(null); setNote(''); setProgress({});
  }
  function notLearned() {
    if (!picked) return;
    setPickedIds((ids) => ids.filter((id) => id !== picked.id));
    setNote(`${picked.full_name} chưa thuộc bài — vẫn nằm trong danh sách lần sau.`);
    setPicked(null);
  }

  return (
    <div>
      <h1>Chọn học sinh trả bài — Đường đua 🏁</h1>
      <div className="toolbar">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 220 }}>
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="picker-check">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} disabled={racing} />
          Không lặp lại người đã chọn
        </label>
      </div>

      {classId && (
        <div className="panel">
          {picked && !racing && (
            <div className="race-winner">🏆 Về đích đầu tiên: <b>{picked.saint_name ? picked.saint_name + ' ' : ''}{picked.full_name}</b></div>
          )}

          {pool.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Đã gọi hết học viên trong lớp. Bấm "Đặt lại" để chạy lại từ đầu.</p>
          ) : (
            <div className="race">
              {pool.map((s, i) => {
                const pr = progress[s.id] || 0;
                const win = picked && picked.id === s.id;
                return (
                  <div className={`lane ${win ? 'win' : ''}`} key={s.id}>
                    <div className="lane-name">{s.full_name}</div>
                    <div className="lane-track">
                      <div className="lane-line" />
                      <div className="runner" style={{ left: `${pr}%`, background: s.avatar_url ? '#fff' : COLORS[i % COLORS.length] }}>
                        {s.avatar_url ? <img className="runner-img" src={s.avatar_url} alt="" /> : initials(s.full_name)}
                      </div>
                    </div>
                    <div className="lane-flag">🏁</div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            <button className="btn" onClick={start} disabled={racing || pool.length === 0}>
              {racing ? 'Đang đua...' : '🏁 Bắt đầu đua'}
            </button>
            {picked && !racing && <button className="btn warning" onClick={notLearned}>✗ Chưa thuộc bài</button>}
            <button className="btn ghost" onClick={reset} disabled={racing}>Đặt lại</button>
          </div>
          {note && <p className="picker-note">{note}</p>}
          <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>Còn lại {pool.length}/{students.length} học viên</p>
        </div>
      )}
    </div>
  );
}
