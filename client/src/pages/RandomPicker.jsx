import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { IconCheck, IconCopy, IconExpand, IconShuffle, IconTrophy, IconVolume, IconVolumeOff } from '../components/Icons.jsx';
import { pickClass, rememberClass } from '../lib/lastClass';
import { sfx } from '../lib/pickerSound';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/confirm';
import PageHeader from '../components/PageHeader.jsx';
import { RaceMode, WheelMode, CardsMode, SlotMode, COLORS, initials, fullName, shuffle } from '../components/PickerModes.jsx';

const MODES = [
  { k: 'race', l: 'Đua', C: RaceMode },
  { k: 'wheel', l: 'Vòng quay', C: WheelMode },
  { k: 'cards', l: 'Lật thẻ', C: CardsMode },
  { k: 'slot', l: 'Quay số', C: SlotMode },
];
const APOSTLES = ['Phêrô', 'Anrê', 'Giacôbê', 'Gioan', 'Philípphê', 'Batôlômêô', 'Tôma', 'Mátthêu', 'Giacôbê Hèm', 'Tađêô', 'Simon', 'Mátthia'];
const p2 = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const hm = (t) => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bộ nhớ trình duyệt bị chặn */ } };
// Lượt gọi / nhóm của lớp trong ngày, nhớ trên máy này (tải lại trang không mất)
const dayKey = (cid) => `picker:${cid}:${todayStr()}`;

export default function RandomPicker() {
  const [tab, setTab] = useState('call'); // call | groups
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [absent, setAbsent] = useState(null); // Set id vắng hôm nay; null = chưa điểm danh
  const [skipAbsent, setSkipAbsent] = useState(() => pref('picker_skip_absent', true));
  const [noRepeat, setNoRepeat] = useState(() => pref('picker_no_repeat', true));
  const [mode, setMode] = useState(() => pref('picker_mode', 'wheel'));
  const [sound, setSound] = useState(sfx.on);
  const [day, setDay] = useState({ called: [], log: [], groups: null });
  const [current, setCurrent] = useState(null); // người vừa trúng (màn hình chúc mừng)
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data)).catch(() => toast.err('Không tải được danh sách lớp')); }, []);
  useEffect(() => { if (!classId && classes.length) setClassId(pickClass(classes)); }, [classes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    rememberClass(classId);
    setCurrent(null);
    if (!classId) { setStudents([]); return; }
    setDay(pref(dayKey(classId), { called: [], log: [], groups: null }));
    api.get(`/students?class_id=${classId}`).then((r) => setStudents(r.data)).catch(() => toast.err('Không tải được học viên'));
    setAbsent(null);
    api.get(`/attendance?class_id=${classId}&date=${todayStr()}`).then((r) => {
      const list = r.data || [];
      setAbsent(list.some((x) => x.status) ? new Set(list.filter((x) => x.status === 'absent' || x.status === 'excused').map((x) => x.id)) : null);
    }).catch(() => setAbsent(null));
  }, [classId]);
  useEffect(() => { setPref('picker_skip_absent', skipAbsent); }, [skipAbsent]);
  useEffect(() => { setPref('picker_no_repeat', noRepeat); }, [noRepeat]);
  useEffect(() => { setPref('picker_mode', mode); }, [mode]);
  const saveDay = (next) => { setDay(next); if (classId) setPref(dayKey(classId), next); };

  // Toàn màn hình: dùng Fullscreen API nếu có, luôn kèm lớp CSS phủ màn hình (iPhone không có API)
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onKey); };
  }, []);
  function toggleFull() {
    if (full) { setFull(false); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); return; }
    setFull(true); stageRef.current?.requestFullscreen?.().catch(() => {});
  }

  const present = students.filter((s) => !(skipAbsent && absent?.has(s.id)));
  const pool = present.filter((s) => !(noRepeat && day.called.includes(s.id)));
  const absentCount = absent ? students.filter((s) => absent.has(s.id)).length : 0;
  const Mode = (MODES.find((m) => m.k === mode) || MODES[1]).C;

  function onPick(s) {
    sfx.win();
    setCurrent(s);
    saveDay({ ...day, called: [...day.called.filter((id) => id !== s.id), s.id], log: [{ id: s.id, name: fullName(s), result: null, t: Date.now() }, ...day.log] });
  }
  function judge(result) {
    if (!current) return;
    const log = day.log.map((x, i) => (i === 0 && x.id === current.id ? { ...x, result } : x));
    // Chưa thuộc: trả em về danh sách để lần sau có thể gọi lại
    const called = result === 'no' ? day.called.filter((id) => id !== current.id) : day.called;
    saveDay({ ...day, log, called });
    if (result === 'no') toast(`${current.full_name} chưa thuộc bài, vẫn có thể được gọi lại.`);
    setCurrent(null);
  }
  async function resetDay() {
    if (!(await confirmDialog('Bắt đầu lại từ đầu cho hôm nay?\n\nDanh sách đã gọi và kết quả thuộc bài của lớp này hôm nay sẽ được xóa trên máy này.'))) return;
    saveDay({ called: [], log: [], groups: day.groups });
    setCurrent(null);
  }

  return (
    <div>
      <PageHeader title="Chọn trả bài" subtitle="Bốc thăm ngẫu nhiên học viên lên trả bài, hoặc chia nhóm cho hoạt động, đố vui." />
      <div className="rpx-top">
        <select data-tour="random-class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy} aria-label="Chọn lớp">
          <option value="">Chọn lớp</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="seg rpx-tabs">
          <button type="button" className={`seg-btn ${tab === 'call' ? 'on' : ''}`} onClick={() => setTab('call')} disabled={busy}>Gọi trả bài</button>
          <button type="button" className={`seg-btn ${tab === 'groups' ? 'on' : ''}`} onClick={() => setTab('groups')} disabled={busy}>Chia nhóm</button>
        </div>
        <span className="rpx-spacer" />
        <button type="button" className="btn ghost sm" onClick={() => { sfx.set(!sound); setSound(!sound); }} aria-label={sound ? 'Tắt âm thanh' : 'Bật âm thanh'} title={sound ? 'Tắt âm thanh' : 'Bật âm thanh'}>
          {sound ? <IconVolume className="bi" /> : <IconVolumeOff className="bi" />}{sound ? 'Âm thanh' : 'Đã tắt tiếng'}
        </button>
      </div>

      {classId && (
        <>
          <div className="rpx-opts">
            <label className="picker-check"><input type="checkbox" checked={skipAbsent} onChange={(e) => setSkipAbsent(e.target.checked)} disabled={busy} />Bỏ qua em vắng hôm nay</label>
            {tab === 'call' && <label className="picker-check"><input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} disabled={busy} />Không gọi lại em đã gọi</label>}
            <span className="muted rpx-optnote">
              {skipAbsent && (absent ? (absentCount ? `${absentCount} em vắng hôm nay được bỏ qua` : 'Hôm nay không em nào vắng') : 'Lớp chưa điểm danh hôm nay')}
            </span>
          </div>

          <div ref={stageRef} className={`panel rpx-stage${full ? ' rpx-full' : ''}`}>
            {tab === 'call' ? (
              <>
                <div className="rpx-stagehead">
                  <div className="rpx-modes" role="tablist" aria-label="Kiểu bốc thăm">
                    {MODES.map((m) => <button key={m.k} type="button" role="tab" aria-selected={mode === m.k} className={`rpx-mode-btn${mode === m.k ? ' on' : ''}`} onClick={() => setMode(m.k)} disabled={busy}>{m.l}</button>)}
                  </div>
                  <span className="rpx-left">Còn <b>{pool.length}</b>/{present.length} em</span>
                  <button type="button" className="btn ghost sm" onClick={toggleFull}><IconExpand className="bi" />{full ? 'Thoát (Esc)' : 'Chiếu'}</button>
                </div>
                {pool.length === 0 && students.length > 0 ? (
                  <div className="rpx-done">
                    <IconCheck className="rpx-done-ic" />
                    <p>Đã gọi hết {present.length} em{skipAbsent && absentCount ? ' có mặt' : ''} hôm nay.</p>
                    <button className="btn" onClick={resetDay}>Bắt đầu lại từ đầu</button>
                  </div>
                ) : students.length === 0 ? (
                  <p className="rpx-hint">Lớp chưa có học viên.</p>
                ) : (
                  <Mode key={mode + classId} pool={pool} onPick={onPick} onBusy={setBusy} />
                )}

                {current && (
                  <div className="rpx-winner" role="dialog" aria-modal="true" aria-label="Người được chọn">
                    <div className="rpx-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 7) * 0.08}s` }} />)}</div>
                    <div className="rpx-winner-card">
                      <div className="rpx-winner-ava" style={{ background: current.avatar_url ? '#fff' : COLORS[0] }}>
                        {current.avatar_url ? <img src={current.avatar_url} alt="" /> : initials(current.full_name)}
                      </div>
                      <div className="rpx-winner-lbl"><IconTrophy className="bi" />Mời em lên trả bài</div>
                      <div className="rpx-winner-name">{fullName(current)}</div>
                      <div className="rpx-winner-act">
                        <button className="btn rpx-ok" onClick={() => judge('ok')}>Thuộc bài</button>
                        <button data-tour="random-notlearned" className="btn warning" onClick={() => judge('no')}>Chưa thuộc</button>
                        <button className="btn ghost" onClick={() => setCurrent(null)}>Đóng</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <GroupMaker students={present} day={day} saveDay={saveDay} full={full} toggleFull={toggleFull} />
            )}
          </div>

          {tab === 'call' && day.log.length > 0 && (
            <div className="panel rpx-log">
              <div className="card-head">
                <h2>Lượt gọi hôm nay ({day.log.length})</h2>
                <button type="button" className="btn ghost sm" onClick={resetDay} disabled={busy}>Bắt đầu lại</button>
              </div>
              <div className="rpx-log-sum">
                <span className="rpx-chip ok">Thuộc {day.log.filter((x) => x.result === 'ok').length}</span>
                <span className="rpx-chip no">Chưa thuộc {day.log.filter((x) => x.result === 'no').length}</span>
              </div>
              <ol className="rpx-log-list">
                {day.log.map((x, i) => (
                  <li key={x.t + '-' + i}>
                    <span className="muted">{hm(x.t)}</span>
                    <span className="rpx-log-name">{x.name}</span>
                    {x.result === 'ok' ? <span className="rpx-chip ok">Thuộc bài</span> : x.result === 'no' ? <span className="rpx-chip no">Chưa thuộc</span> : <span className="muted">Chưa ghi</span>}
                  </li>
                ))}
              </ol>
              <p className="muted rpx-small">Danh sách này chỉ lưu trên máy này trong hôm nay để tiện theo dõi, không ghi vào bảng điểm.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Chia nhóm ngẫu nhiên ---------------- */
function GroupMaker({ students, day, saveDay, full, toggleFull }) {
  const [by, setBy] = useState(() => pref('picker_group_by', 'count')); // count: số nhóm | size: số em mỗi nhóm
  const [n, setN] = useState(() => pref('picker_group_n', 4));
  const [apostle, setApostle] = useState(() => pref('picker_group_apostle', false));
  const [shown, setShown] = useState(Infinity); // số tên đã hiện (hiệu ứng chia bài)
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => { setPref('picker_group_by', by); setPref('picker_group_n', n); setPref('picker_group_apostle', apostle); }, [by, n, apostle]);
  const groups = day.groups;
  const total = groups ? groups.reduce((s, g) => s + g.members.length, 0) : 0;

  function make() {
    const num = Number(n) || 0;
    if (num < 1) { toast.err(by === 'count' ? 'Nhập số nhóm' : 'Nhập số em mỗi nhóm'); return; }
    const count = by === 'count' ? Math.min(num, students.length) : Math.ceil(students.length / num);
    if (count < 1) { toast.err('Lớp chưa có học viên có mặt'); return; }
    if (count > 30) { toast.err('Tối đa 30 nhóm'); return; }
    const gs = Array.from({ length: count }, (_, i) => ({ name: apostle && count <= 12 ? `Nhóm ${APOSTLES[i]}` : `Nhóm ${i + 1}`, members: [] }));
    // Chia lần lượt từng em vào các nhóm -> số em các nhóm chênh nhau tối đa 1
    shuffle(students).forEach((s, i) => gs[i % count].members.push({ id: s.id, name: fullName(s) }));
    saveDay({ ...day, groups: gs });
    // Hiệu ứng chia bài: hiện dần từng tên theo thứ tự đã chia
    clearInterval(timer.current); setShown(0);
    let k = 0; const all = students.length;
    timer.current = setInterval(() => { k += 1; setShown(k); sfx.pop(); if (k >= all) { clearInterval(timer.current); sfx.win(); } }, Math.max(35, Math.min(110, 2400 / Math.max(1, all))));
  }
  async function copy() {
    const text = groups.map((g) => `${g.name} (${g.members.length}): ${g.members.map((m) => m.name).join(', ')}`).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Đã sao chép danh sách nhóm'); } catch { toast.err('Không sao chép được'); }
  }
  // Thứ tự hiện: vòng 1 mỗi nhóm 1 em, vòng 2... (giống chia bài)
  const orderIdx = (gi, mi) => mi * (groups?.length || 1) + gi;

  return (
    <div className="rpx-groups">
      <div className="rpx-stagehead">
        <div className="rpx-gform">
          <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Cách chia">
            <option value="count">Chia thành</option>
            <option value="size">Mỗi nhóm</option>
          </select>
          <input type="number" min="1" max="30" value={n} onChange={(e) => setN(e.target.value)} aria-label={by === 'count' ? 'Số nhóm' : 'Số em mỗi nhóm'} />
          <span>{by === 'count' ? 'nhóm' : 'em'}</span>
          <label className="picker-check rpx-apostle"><input type="checkbox" checked={apostle} onChange={(e) => setApostle(e.target.checked)} />Tên 12 Tông đồ</label>
        </div>
        <span className="rpx-left">{students.length} em có mặt</span>
        <button type="button" className="btn ghost sm" onClick={toggleFull}><IconExpand className="bi" />{full ? 'Thoát (Esc)' : 'Chiếu'}</button>
      </div>
      <div className="rpx-actions">
        <button className="btn rpx-go" onClick={make} disabled={!students.length}><IconShuffle className="bi" />{groups ? 'Chia lại' : 'Chia nhóm'}</button>
        {groups && <button className="btn ghost" onClick={copy}><IconCopy className="bi" />Sao chép</button>}
      </div>
      {groups ? (
        <div className="rpx-group-grid">
          {groups.map((g, gi) => (
            <div key={gi} className="rpx-group" style={{ '--gc': COLORS[gi % COLORS.length] }}>
              <div className="rpx-group-h"><b>{g.name}</b><span>{g.members.filter((_, mi) => orderIdx(gi, mi) < shown).length}</span></div>
              <ol>{g.members.map((m, mi) => (orderIdx(gi, mi) < shown ? <li key={m.id} className="rpx-pop">{m.name}</li> : null))}</ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="rpx-hint">Chọn số nhóm hoặc số em mỗi nhóm rồi bấm "Chia nhóm". Các nhóm chênh nhau tối đa 1 em.</p>
      )}
      {groups && total !== students.length && <p className="muted rpx-small">Danh sách có mặt đã thay đổi sau lần chia này, bấm "Chia lại" để cập nhật.</p>}
    </div>
  );
}
