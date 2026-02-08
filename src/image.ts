// src/image.ts

// Resize ảnh rồi trả về dataURL (jpeg) để lưu vào IndexedDB ổn định trên iOS Safari
export async function resizeImageToDataUrl(
  file: Blob,
  maxSide = 1280,
  quality = 0.82
): Promise<string> {
  const img = await loadImage(file);
  const { w, h } = fitMax(img.width, img.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // fallback: đọc thẳng file -> dataURL (không resize)
    return blobToDataUrl(file);
  }

  ctx.drawImage(img, 0, 0, w, h);

  // Ưu tiên JPEG cho nhẹ + ổn định
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality);
  });

  return blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ---------------- helpers ---------------- */

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function fitMax(w: number, h: number, maxSide: number) {
  if (w <= maxSide && h <= maxSide) return { w, h };
  const scale = maxSide / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}
