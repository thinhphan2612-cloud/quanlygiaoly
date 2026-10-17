import { useEffect, useRef, useState } from 'react';

// Nút "⋯" mở menu thao tác phụ của một dòng trong bảng.
// items: [{ label, onClick, danger? }]. Menu định vị theo màn hình (fixed) để không bị khung bảng cắt mất.
export default function RowMenu({ items, label = 'Thao tác khác', trigger, triggerClass }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  function toggle() {
    if (pos) { setPos(null); return; }
    const r = btn.current.getBoundingClientRect();
    const width = 200;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = r.bottom + 6;
    const top = below + items.length * 40 + 12 > window.innerHeight ? Math.max(8, r.top - items.length * 40 - 18) : below;
    setPos({ left, top, width });
  }

  return (
    <>
      <button ref={btn} type="button" className={triggerClass || 'row-menu-btn'} aria-label={label} title={label} onClick={toggle} aria-haspopup="menu" aria-expanded={!!pos}>{trigger || '⋯'}</button>
      {pos && (
        <>
          <div className="row-menu-backdrop" onClick={() => setPos(null)} />
          <div className="row-menu" style={{ left: pos.left, top: pos.top, width: pos.width }} role="menu">
            {items.filter(Boolean).map((it) => (
              <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''}
                onClick={() => { setPos(null); it.onClick(); }}>{it.label}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
