/** Prepare property photos without replacing a good original with a black canvas export. */
export function preparePropertyPhoto(original: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sourceDecoded = false;
    const images: HTMLImageElement[] = [];
    const urls: string[] = [];
    const canvases: HTMLCanvasElement[] = [];

    const finish = (result?: Blob, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      images.forEach(image => {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
      });
      urls.forEach(url => URL.revokeObjectURL(url));
      canvases.forEach(canvas => { canvas.width = 0; canvas.height = 0; });
      if (error) reject(error);
      else resolve(result || original);
    };

    const timeout = setTimeout(() => {
      // Never leave a late onload/toBlob callback processing another photo in the background.
      if (sourceDecoded) finish(original);
      else finish(undefined, new Error('Photo processing timed out. Please retry the original photo.'));
    }, 8000);

    const makeImage = (blob: Blob) => {
      const image = new Image();
      images.push(image);
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return { image, url };
    };
    const makeCanvas = (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvases.push(canvas);
      return canvas;
    };
    const hasVisiblePixels = (image: CanvasImageSource): boolean => {
      const sample = makeCanvas(16, 16);
      const context = sample.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      context.drawImage(image, 0, 0, 16, 16);
      const pixels = context.getImageData(0, 0, 16, 16).data;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0 && (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8)) return true;
      }
      // Legitimately dark photos also keep their original bytes; never reject or delete them.
      return false;
    };

    try {
      const source = makeImage(original);
      source.image.onerror = () => finish(undefined, new Error('This photo could not be read. Please select a JPEG or PNG image.'));
      source.image.onload = () => {
        if (settled) return;
        sourceDecoded = true;
        try {
          const width = source.image.naturalWidth;
          const height = source.image.naturalHeight;
          if (!width || !height) {
            finish(undefined, new Error('This photo has invalid image dimensions.'));
            return;
          }
          // These include the affected 720x1600 screenshots: preserve them byte-for-byte.
          if (original.type === 'image/jpeg' && original.size <= 1024 * 1024 && Math.max(width, height) <= 1600) {
            finish(original);
            return;
          }
          if (original.type === 'image/gif' || original.type === 'image/svg+xml') {
            finish(original);
            return;
          }
          const ratio = Math.min(1, 1600 / Math.max(width, height));
          const canvas = makeCanvas(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
          const context = canvas.getContext('2d');
          if (!context) { finish(original); return; }
          context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
          if (!hasVisiblePixels(canvas)) { finish(original); return; }
          canvas.toBlob(result => {
            if (settled) return;
            if (!result || !result.size || result.size >= original.size) { finish(original); return; }
            try {
              // Validate the encoded bytes too: a successful toBlob is not proof of good pixels.
              const output = makeImage(result);
              output.image.onerror = () => finish(original);
              output.image.onload = () => {
                if (settled) return;
                try {
                  const valid = output.image.naturalWidth === canvas.width &&
                    output.image.naturalHeight === canvas.height && hasVisiblePixels(output.image);
                  finish(valid ? result : original);
                } catch { finish(original); }
              };
              output.image.src = output.url;
            } catch { finish(original); }
          }, 'image/jpeg', 0.80);
        } catch { finish(original); }
      };
      source.image.src = source.url;
    } catch { finish(undefined, new Error('Could not prepare this photo. Please retry.')); }
  });
}
