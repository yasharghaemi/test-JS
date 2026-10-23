/**
 * Scales an image down to `width` px wide, keeping its aspect ratio. Images already
 * that narrow, and SVGs, are returned unchanged. JPEGs stay JPEG; anything else
 * becomes PNG so transparency survives.
 */
export async function resizeToWidth(file: File, width: number): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file;
  const image = await loadImage(file);
  if (image.width <= width) return file;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((image.height * width) / image.width);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not resize image'))), type, 0.9);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
