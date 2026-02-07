// src/image.ts

// Resize ảnh để nhẹ + lưu vào IndexedDB
export async function resizeImageBlob(
  file: Blob,
  maxSide = 1280,
  quality = 0.82
): Promise<Blob> {
  const img = await loadImage(file);
  const { w, h } = fitMax(img.width, img.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file as Blob;

  ctx.drawImage(img, 0, 0, w, h);

  // ưu tiên jpeg để nhẹ; nếu bạn cần giữ PNG trong suốt thì mình chỉnh thêm sau
  const out: Blob = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b ?? (file as Blob)),
      "image/jpeg",
      quality
    );
  });

  return out;
}

// ✅ FIX SAFARI / IndexedDB: đừng check kiểu cứng, cứ thử createObjectURL
export function blobToObjectUrl(blobLike: any): string | null {
  if (!blobLike) return null;

  // 1) thử trực tiếp (đa số trường hợp OK)
  try {
    return URL.createObjectURL(blobLike as Blob);
  } catch {}

  // 2) fallback nếu dữ liệu là ArrayBuffer/TypedArray
  try {
    if (blobLike instanceof ArrayBuffer) {
      return URL.createObjectURL(new Blob([blobLike]));
    }
    if (ArrayBuffer.isView(blobLike)) {
  // copy sang Uint8Array để tránh SharedArrayBuffer type error
  const u8 = new Uint8Array(blobLike.buffer as ArrayBuffer);
  return URL.createObjectURL(new Blob([u8]));
}

  } catch {}

  return null;
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
