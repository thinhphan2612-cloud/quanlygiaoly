import { useEffect, useRef, useState } from 'react';
import api from '../api';

export default function RandomPicker() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [display, setDisplay] = useState('Nhấn "Chọn ngẫu nhiên"');
  const [picked, setPicked] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [noRepeat, setNoRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [note, setNote] = useState('');
  const timer = useRef(null);

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)); }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    api.get(`/students?class_id=${classId}`).then((r) => setStudents(r.data));
    setPickedIds([]);
    setPicked(null);
    setDisplay('Nhấn "Chọn ngẫu nhiên"');
  }, [classId]);

  const pool = noRepeat ? students.filter((s) => !pickedIds.includes(s.id)) : students;

  function spin() {
    if (pool.length === 0) {
      setDisplay(noRepeat ? 'Đã chọn hết học viên!' : 'Lớp chưa có học viên');
      return;
    }
    setSpinning(true);
    setPicked(null);
    setNote('');
    let ticks = 0;
    const total = 20 + Math.floor(Math.random() * 10);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const r = students[Math.floor(Math.random() * students.length)];
      setDisplay(r.full_name);
      ticks++;
      if (ticks >= total) {
        clearInterval(timer.current);
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        setDisplay(`${chosen.saint_name ? chosen.saint_name + ' ' : ''}${chosen.full_name}`);
        setPicked(chosen);
        setPickedIds((ids) => [...ids, chosen.id]);
        setSpinning(false);
      }
    }, 80);
  }

  useEffect(() => () => clearInterval(timer.current), []);

  function reset() {
    setPickedIds([]);
    setPicked(null);
    setNote('');
    setDisplay('Nhấn "Chọn ngẫu nhiên"');
  }

  // Chưa thuộc bài: không tính qua lượt → giữ lại trong danh sách chọn lần sau
  function notLearned() {
    if (!picked) return;
    setPickedIds((ids) => ids.filter((id) => id !== picked.id));
    setNote(`${picked.full_name} chưa thuộc bài — vẫn nằm trong danh sách chọn lần sau.`);
    setPicked(null);
  }

  return (
    <div>
      <h1>Chọn ngẫu nhiên học sinh trả bài</h1>
      <div className="toolbar">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 220 }}>
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="picker-check">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          Không lặp lại người đã chọn
        </label>
      </div>

      {classId && (
        <div className="panel">
          <div className="picker-result">{display}</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={spin} disabled={spinning || students.length === 0}>
              {spinning ? 'Đang chọn...' : '🎲 Chọn ngẫu nhiên'}
            </button>
            {picked && !spinning && (
              <button className="btn warning" onClick={notLearned}>✗ Chưa thuộc bài</button>
            )}
            <button className="btn ghost" onClick={reset} disabled={spinning}>Đặt lại</button>
          </div>
          {note && <p className="picker-note">{note}</p>}
          <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}>
            Còn lại {pool.length}/{students.length} học viên
          </p>
        </div>
      )}
    </div>
  );
}
