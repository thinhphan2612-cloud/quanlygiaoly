import { useToast } from '../lib/toast';

// Hiển thị thông báo từ toast() (lib/toast). Gắn một lần ở gốc App.
export default function Toaster() {
  const [t, close] = useToast();
  if (!t) return null;
  return (
    <div key={t.id} className={`app-toast ${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'} onClick={close}>
      {t.text}
    </div>
  );
}
