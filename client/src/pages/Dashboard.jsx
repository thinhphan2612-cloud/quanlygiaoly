import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Donut from '../components/Donut.jsx';
import { IconStudents, IconClass, IconTeacher } from '../components/Icons.jsx';

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];

function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="muted">Đang tải...</div>;

  const { counts, studentsPerClass, topStudents, classAverages } = data;
  const donutSegments = studentsPerClass
    .filter((c) => c.count > 0)
    .map((c, i) => ({ label: c.name, value: c.count, color: PALETTE[i % PALETTE.length] }));

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Tổng quan</h1>
      <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
        Điều hành lớp giáo lý cùng hệ thống quản lý.
      </p>

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
                <tr><th>Họ tên</th><th>Điểm TB</th><th>Tỷ lệ</th></tr>
              </thead>
              <tbody>
                {topStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="stu-cell">
                        <div className="stu-avatar">{initials(s.full_name)}</div>
                        <div>{s.saint_name ? s.saint_name + ' ' : ''}{s.full_name}</div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.avg}</td>
                    <td><span className="pct">{Math.round((s.avg / 10) * 100)}%</span></td>
                  </tr>
                ))}
                {topStudents.length === 0 && (
                  <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 24 }}>Chưa có điểm để xếp hạng</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Kết quả theo lớp */}
          <div className="panel">
            <div className="card-head"><h2>Kết quả theo lớp</h2></div>
            <div className="perf">
              {classAverages.map((c, i) => {
                const pct = Math.min((c.avg / 10) * 100, 100);
                const color = PALETTE[i % PALETTE.length];
                return (
                  <div className="item" key={c.name}>
                    <div className="cls">{c.name}</div>
                    <div className="track">
                      <div className="fill" style={{ width: `${pct}%`, background: color }}>{c.avg}</div>
                    </div>
                    <div className="score">{Math.round(pct)}%</div>
                  </div>
                );
              })}
              {classAverages.length === 0 && (
                <div className="muted" style={{ textAlign: 'center', padding: 12 }}>Chưa có dữ liệu điểm theo lớp</div>
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
