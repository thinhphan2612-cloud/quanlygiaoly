// Một dòng bật/tắt: nhãn (kèm mô tả ngắn nếu có) + công tắc bên phải.
export default function ToggleRow({ label, desc, on, onClick, disabled }) {
  return (
    <div className="toggle-row">
      <span className="stx-tr-text"><span>{label}</span>{desc && <small>{desc}</small>}</span>
      <button className={`switch ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on} aria-label={label} disabled={disabled}>
        <span className="knob" />
      </button>
    </div>
  );
}
