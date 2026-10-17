// Đầu trang dùng chung: tiêu đề + một dòng mô tả bên trái, nút chính bên phải.
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div className="ph-text">
        <h1>{title}</h1>
        {subtitle && <p className="ph-sub">{subtitle}</p>}
      </div>
      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}
