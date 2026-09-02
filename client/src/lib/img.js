// Thu nhỏ ảnh về data URL vuông (dùng cho logo giáo xứ + ảnh đại diện).
export function fileToDataUrl(file, size = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const s = Math.min(img.width, img.height);
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Thu nhỏ ảnh -> Blob PNG (dùng để upload khung chứng chỉ; giữ tỉ lệ, giới hạn bề rộng).
export function fileToPngBlob(file, maxW = 2000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Thu nhỏ ảnh giữ NGUYÊN tỉ lệ (dùng cho chữ ký) -> PNG (giữ nền trong nếu có).
export function fileToDataUrlWide(file, maxW = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
