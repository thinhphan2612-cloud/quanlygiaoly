// Âm thanh nhỏ cho trang Chọn trả bài, tạo bằng WebAudio (không cần file âm thanh).
let ctx = null;
const ac = () => {
  try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
};
function beep(freq, dur, type = 'sine', vol = 0.08, when = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
let lastTick = 0;
export const sfx = {
  on: (() => { try { return localStorage.getItem('picker_sound') !== '0'; } catch { return true; } })(),
  set(v) { this.on = v; try { localStorage.setItem('picker_sound', v ? '1' : '0'); } catch { /* noop */ } if (v) ac(); },
  // tiếng tích khi vòng quay / quay số đi qua một tên (giới hạn tần suất)
  tick() { if (!this.on) return; const n = performance.now(); if (n - lastTick < 35) return; lastTick = n; beep(1300, 0.03, 'square', 0.035); },
  // chuông khi có người trúng
  win() { if (!this.on) return; [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.35, 'triangle', 0.09, i * 0.09)); },
  flip() { if (!this.on) return; beep(420, 0.08, 'sine', 0.06); },
  pop() { if (!this.on) return; beep(880, 0.05, 'sine', 0.05); },
};
