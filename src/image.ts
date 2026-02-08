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

// ✅ FIX SAFARI / IndexedDB: hỗ trợ Blob + ArrayBuffer + TypedArray (kể cả SharedArrayBuffer)
export function blobToObjectUrl(blobLike: any): string | null {
  if (!blobLike) return null;

  // 1) Nếu là Blob/File chuẩn
  try {
    return URL.createObjectURL(blobLike as Blob);
  } catch {}

  // 2) Nếu là ArrayBuffer
  try {
    if (blobLike instanceof ArrayBuffer) {
      return URL.createObjectURL(new Blob([blobLike]));
    }
  } catch {}

  // 3) Nếu là TypedArray/DataView (ArrayBufferView) -> copy sang ArrayBuffer thường
  try {
    if (ArrayBuffer.isView(blobLike)) {
      const view = blobLike as ArrayBufferView;

      // copy bytes sang buffer mới (ArrayBuffer thường) để né SharedArrayBuffer
      const copy = new Uint8Array(view.byteLength);
      copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));

      return URL.createObjectURL(new Blob([copy]));
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
