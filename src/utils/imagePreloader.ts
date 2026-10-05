const preloadedImageUrls = new Set<string>();

/**
 * Schedule image downloads after the current render without blocking the UI.
 * URLs are preloaded at most once per app session; the browser cache serves
 * subsequent carousel navigation without another Storage download.
 */
export function preloadImageUrls(urls: string[]): () => void {
  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (cancelled) return;

    urls.forEach((url) => {
      if (!url || preloadedImageUrls.has(url)) return;

      preloadedImageUrls.add(url);
      const img = new Image();
      img.loading = 'eager';
      img.decoding = 'async';
      img.onerror = () => preloadedImageUrls.delete(url);
      img.src = url;
    });
  }, 0);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

