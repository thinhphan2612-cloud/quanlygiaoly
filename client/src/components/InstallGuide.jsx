import { useEffect, useState } from 'react';
import { canInstall, promptInstall, onInstallChange, platform } from '../lib/pwa';

const APP_URL = 'app.giaoly.com.vn';

const STEPS = {
  desktop: {
    label: 'Máy tính',
    title: 'Trên máy tính (Chrome hoặc Edge)',
    steps: [
      <>Mở trình duyệt và vào đúng địa chỉ <b>{APP_URL}</b>.</>,
      <>Nhìn cuối thanh địa chỉ (góc phải), bấm nút <b>Cài đặt</b> (hình màn hình nhỏ có mũi tên xuống). Nếu không thấy: mở menu ba chấm dọc ở góc phải rồi chọn <b>Cài Giáo Lý Số</b>.</>,
      <>Bấm <b>Cài đặt</b>. Ứng dụng mở thành cửa sổ riêng, ghim được vào thanh Taskbar (Windows) hoặc Dock (Mac).</>,
    ],
  },
  ios: {
    label: 'iPhone / iPad',
    title: 'Trên iPhone / iPad (dùng Safari)',
    steps: [
      <>Mở <b>Safari</b> và vào đúng địa chỉ <b>{APP_URL}</b> (không dùng được trên Chrome của iPhone).</>,
      <>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên hướng lên) ở thanh công cụ.</>,
      <>Vuốt xuống và chọn <b>Thêm vào MH chính</b> (Add to Home Screen).</>,
      <>Bấm <b>Thêm</b> ở góc phải trên. Biểu tượng Giáo Lý Số sẽ nằm ở màn hình chính như một ứng dụng.</>,
    ],
  },
  android: {
    label: 'Android',
    title: 'Trên Android (dùng Chrome)',
    steps: [
      <>Mở <b>Chrome</b> và vào đúng địa chỉ <b>{APP_URL}</b>.</>,
      <>Bấm menu ba chấm dọc ở góc phải trên.</>,
      <>Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào Màn hình chính</b>.</>,
      <>Bấm <b>Cài đặt</b> (hoặc <b>Thêm</b>). Biểu tượng sẽ xuất hiện ở màn hình chính, mở ra chạy như một ứng dụng riêng.</>,
    ],
  },
};

export default function InstallGuide({ onClose }) {
  const [tab, setTab] = useState(platform());
  const [installable, setInstallable] = useState(canInstall());
  const [done, setDone] = useState(false);

  useEffect(() => onInstallChange(setInstallable), []);

  const cur = STEPS[tab];
  const showQuickInstall = installable && (tab === 'android' || tab === 'desktop');

  async function quickInstall() {
    const ok = await promptInstall();
    if (ok) setDone(true);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Cài Giáo Lý Số thành ứng dụng</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Cài một lần để mở nhanh như app riêng, không cần gõ lại đường link mỗi lần.
        </p>

        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          <b>Lưu ý:</b> Hãy cài đúng địa chỉ <b>app.giaoly.com.vn</b> (có chữ <b>“app.”</b> phía trước).
          Đừng cài <b>giaoly.com.vn</b> vì đó là trang giới thiệu, không phải ứng dụng.
        </div>

        <div className="seg" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.keys(STEPS).map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setDone(false); }}>{STEPS[k].label}</button>
          ))}
        </div>

        <h3 style={{ margin: '4px 0 6px', fontSize: 15 }}>{cur.title}</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: 14, marginTop: 0 }}>
          {cur.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
        </ol>

        {showQuickInstall && (
          <div style={{ marginTop: 6 }}>
            {done
              ? <div style={{ color: 'var(--success)', fontWeight: 600 }}>Đã cài đặt. Hãy tìm biểu tượng Giáo Lý Số trên máy.</div>
              : <button className="btn" onClick={quickInstall}>Cài đặt ngay</button>}
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Nếu nút không chạy, làm theo các bước ở trên.</p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
