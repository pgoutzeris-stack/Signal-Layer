// Keep the first photograph; logos may intentionally repeat.
export function photoSlots(memo) {
  return [memo.cover, memo.insight, ...(memo.potentials || []).map(p => p.image)].filter(Boolean);
}
export function similarPixels(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let error = 0, mean = 0;
  for (let i = 0; i < a.length; i++) { error += Math.abs(a[i] - b[i]); mean += a[i]; }
  mean /= a.length;
  let variance = 0;
  for (const value of a) variance += (value - mean) ** 2;
  // Uniform backgrounds are not reliable photograph identities.
  return variance / a.length > 100 && error / a.length < 6;
}
export async function removeDuplicateMemoPhotos(memo, fingerprint = browserFingerprint) {
  const seen = [], removed = [];
  for (const image of photoSlots(memo)) {
    if (!image.src) continue;
    const src = image.src;
    const pixels = await fingerprint(src).catch(() => null);
    if (seen.some(previous => previous.src === src || similarPixels(previous.pixels, pixels))) {
      image.src = "";
      removed.push(image);
    } else seen.push({ src, pixels });
  }
  return removed.length;
}
async function browserFingerprint(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Image timeout")), 5000);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("Image unavailable")); };
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 24, 24);
  const rgba = ctx.getImageData(0, 0, 24, 24).data;
  return Array.from(rgba).filter((_, i) => i % 4 !== 3);
}
