import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth.jsx';
import Donut from '../components/Donut.jsx';
import { LeaderboardTable } from '../components/Leaderboard.jsx';
import Avatar from '../components/Avatar.jsx';
import { IconStudents, IconClass, IconTeacher } from '../components/Icons.jsx';

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];

function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}

// Biểu đồ cột tỷ lệ điểm danh theo tuần
function WeeklyChart({ data }) {
  if (!data.length) return <p className="muted" style={{ margin: 0 }}>Chưa có dữ liệu điểm danh.</p>;
  const W = 640, H = 180, pad = 28, bw = (W - pad * 2) / data.length;
  const x = (i) => pad + i * bw + bw / 2;
  const y = (r) => H - pad - (r / 100) * (H - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.rate)}`).join(' ');
  return (
    <div className="table-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="week-chart" style={{ width: '100%', minWidth: 480 }}>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth="1" />
            <text x={4} y={y(g) + 4} fontSize="10" fill="var(--muted)">{g}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - bw * 0.28} y={y(d.rate)} width={bw * 0.56} height={H - pad - y(d.rate)} rx="4" fill="var(--primary)" opacity="0.18" />
            <text x={x(i)} y={y(d.rate) - 6} fontSize="11" fill="var(--primary)" textAnchor="middle" fontWeight="600">{d.rate}%</text>
            <text x={x(i)} y={H - pad + 15} fontSize="10" fill="var(--muted)" textAnchor="middle">{d.label}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.rate)} r="3.5" fill="var(--primary)" />)}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [year, setYear] = useState('');
  const [lbClasses, setLbClasses] = useState([]);
  const [lbClass, setLbClass] = useState('');
  const [lbPeriod, setLbPeriod] = useState('all');

  function loadDash(y) {
    api.get('/dashboard' + (y ? `?year=${encodeURIComponent(y)}` : '')).then((r) => { setData(r.data); setYear(r.data.year || ''); });
  }
  useEffect(() => {
    loadDash();
    api.get('/classes').then((r) => { setLbClasses(r.data); if (r.data[0]) setLbClass(r.data[0].id); });
  }, []);

  const _today = new Date().toISOString().slice(0, 10);
  const lbRange = lbPeriod === 'month' ? { from: _today.slice(0, 8) + '01', to: _today } : { from: '2000-01-01', to: _today };

  if (!data) return <div className="muted">Đang tải...</div>;

  const { counts, studentsPerClass, topStudents, classAverages, attendanceByWeek = [] } = data;
  const isCurrent = !data.currentYear || year === data.currentYear;
  const donutSegments = studentsPerClass
    .filter((c) => c.count > 0)
    .map((c, i) => ({ label: c.name, value: c.count, color: PALETTE[i % PALETTE.length] }));

  return (
    <div>
      <div className="dash-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>Tổng quan</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            {isCurrent ? 'Điều hành lớp giáo lý cùng hệ thống quản lý.' : `Đang xem lại dữ liệu năm học ${year} (đã lưu trữ).`}
          </p>
        </div>
        {isAdmin && data.years?.length > 1 && (
          <select value={year} onChange={(e) => loadDash(e.target.value)} style={{ width: 190 }}>
            {data.years.map((y) => <option key={y} value={y}>Năm học {y}{y === data.currentYear ? ' (hiện tại)' : ''}</option>)}
          </select>
        )}
      </div>

      {/* Thẻ thống kê */}
      <div className="dash-stats">
        <div className="dash-stat st-purple">
          <div><div className="lbl">Học viên</div><div className="num">{counts.students}</div></div>
          <div className="ic"><IconStudents /></div>
        </div>
        <div className="dash-stat st-blue">
          <div><div className="lbl">Giáo lý viên</div><div className="num">{counts.teachers}</div></div>
          <div className="ic"><IconTeacher /></div>
        </div>
        <div className="dash-stat st-peach">
          <div><div className="lbl">Lớp học</div><div className="num">{counts.classes}</div></div>
          <div className="ic"><IconClass /></div>
        </div>
      </div>

      {/* Biểu đồ điểm danh theo tuần */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="card-head"><h2>Tỷ lệ điểm danh theo tuần</h2></div>
        <WeeklyChart data={attendanceByWeek} />
      </div>

      {/* Bảng xếp hạng thi đua (chỉ năm hiện tại) */}
      {isCurrent && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="card-head">
            <h2>🏆 Bảng xếp hạng thi đua</h2>
            <select value={lbPeriod} onChange={(e) => setLbPeriod(e.target.value)} style={{ width: 150 }}>
              <option value="all">Toàn bộ</option>
              <option value="month">Tháng này</option>
            </select>
          </div>
          {lbClasses.length > 1 && (
            <div className="lb-tabs">
              {lbClasses.map((c) => (
                <button key={c.id} className={lbClass === c.id ? 'on' : ''} onClick={() => setLbClass(c.id)}>{c.name}</button>
              ))}
            </div>
          )}
          {lbClass ? <LeaderboardTable classId={lbClass} range={lbRange} /> : <p className="muted">Chưa có lớp nào.</p>}
        </div>
      )}

      <div className="dash-grid">
        {/* Cột trái */}
        <div className="dash-col">
          {/* Học viên xuất sắc */}
          <div className="panel">
            <div className="card-head">
              <h2>Học viên xuất sắc</h2>
              <span className="link" onClick={() => navigate('/grades')}>Xem điểm</span>
            </div>
            <table className="rank-table">
              <thead>
                <tr><th>Họ tên</th><th>Lớp</th><th>Điểm TB</th><th>Chuyên cần</th></tr>
              </thead>
              <tbody>
                {topStudents.map((s) => (
                  <tr key={s.id} className="click-row" onClick={() => navigate(`/students/${s.id}`)}>
                    <td>
                      <div className="stu-cell">
                        <Avatar url={s.avatar_url} name={s.full_name} size={36} />
                        <div>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</div>
                      </div>
                    </td>
                    <td className="muted">{s.class_name || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{s.avg}</td>
                    <td>{s.rate != null ? <span className="pct">{s.rate}%</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {topStudents.length === 0 && (
                  <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>Chưa có điểm để xếp hạng</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Kết quả theo lớp */}
          <div className="panel">
            <div className="card-head"><h2>Kết quả theo lớp</h2></div>
            <div className="perf">
              {classAverages.map((c, i) => {
                const pct = c.avg != null ? Math.min((c.avg / 10) * 100, 100) : 0;
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div className="item click-row" key={c.id} onClick={() => navigate(`/grades?class=${c.id}`)}>
                    <div className="cls">{c.name}<span className="cls-sub">{c.count} HV</span></div>
                    <div className="track">
                      <div className="fill" style={{ width: `${pct}%`, background: color }}>{c.avg ?? '—'}</div>
                    </div>
                    <div className="score">{c.rate != null ? <span className="cc-chip">CC {c.rate}%</span> : <span className="muted">—</span>}</div>
                  </div>
                );
              })}
              {classAverages.length === 0 && (
                <div className="muted" style={{ textAlign: 'center', padding: 12 }}>Chưa có lớp nào</div>
              )}
            </div>
          </div>
        </div>

        {/* Cột phải */}
        <div className="dash-col">
          {/* Donut: học viên theo lớp */}
          <div className="panel">
            <div className="card-head"><h2>Học viên theo lớp</h2></div>
            <div className="donut-wrap">
              <Donut segments={donutSegments} total={counts.students} centerTop="Tổng HV" />
              <div className="legend">
                {donutSegments.map((seg) => (
                  <div className="row" key={seg.label}>
                    <span className="dot" style={{ background: seg.color }} />
                    <span>{seg.label}</span>
                    <span className="val">{seg.value}</span>
                  </div>
                ))}
                {donutSegments.length === 0 && <div className="muted">Chưa có học viên trong lớp</div>}
              </div>
            </div>
          </div>

          {/* Thẻ hành động nhanh */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(160deg, #2563eb, #3b82f6)', color: '#fff', padding: 22 }}>
              <div style={{ fontSize: 30 }}>🎲</div>
              <div style={{ fontWeight: 600, margin: '10px 0 4px' }}>Chọn ngẫu nhiên trả bài</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 14 }}>
                Bốc thăm học sinh lên trả bài một cách công bằng.
              </div>
              <button
                onClick={() => navigate('/random')}
                style={{ background: '#fff', color: 'var(--primary)', border: 'none', padding: '9px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                Bắt đầu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
