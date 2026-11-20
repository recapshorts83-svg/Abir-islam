const MAX_WIDTH = 720;
const MAX_DATA_URL_LENGTH = 320_000;

export async function compressThumbnailToDataUrl(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPG, PNG, and WebP thumbnail images are supported.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Selected image is too large (max 10 MB).');
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode thumbnail image.'));
      el.src = imageUrl;
    });

    const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to process thumbnail image in this browser.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.35) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error('Compressed thumbnail exceeds size limit. Please use a smaller image or image URL.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
