// Khung xương hiển thị trong lúc chờ dữ liệu, thay cho chữ "Đang tải..." hoặc bảng trống chớp lên.

// Các dòng xương đặt trong <tbody> của bảng có sẵn.
export function SkeletonRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="skel-row" aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}><div className="skel" style={{ width: c === 0 ? '70%' : `${45 + ((r * 7 + c * 13) % 40)}%` }} /></td>
      ))}
    </tr>
  ));
}

// Bảng xương đứng riêng (khi chưa có cấu trúc bảng thật).
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <table aria-busy="true" aria-label="Đang tải">
      <tbody><SkeletonRows rows={rows} cols={cols} /></tbody>
    </table>
  );
}

// Khung xương cho trang Tổng quan: 3 thẻ số liệu + 2 khối nội dung.
export function SkeletonDashboard() {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <div className="skel" style={{ width: 180, height: 26, marginBottom: 10 }} />
      <div className="skel" style={{ width: 280, height: 14, marginBottom: 24 }} />
      <div className="dash-stats">
        {[0, 1, 2].map((i) => <div key={i} className="dash-stat"><div style={{ flex: 1 }}><div className="skel" style={{ width: '50%', height: 12, marginBottom: 12 }} /><div className="skel" style={{ width: '30%', height: 26 }} /></div></div>)}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="panel">
          <div className="skel" style={{ width: 220, height: 16, marginBottom: 18 }} />
          <div className="skel" style={{ width: '100%', height: 120 }} />
        </div>
      ))}
    </div>
  );
}
