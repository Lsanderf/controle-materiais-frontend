// Map the visible guide through object-fit: contain to native camera pixels.
// Keep a small horizontal safety margin outside the guide for quiet zones.
export function nfeReadRegion(width, height, videoRect, guideRect) {
  if (!width || !height || !videoRect?.width || !videoRect?.height ||
      !guideRect?.width || !guideRect?.height) return { x: 0, y: 0, width, height };
  const scale = Math.min(videoRect.width / width, videoRect.height / height);
  const left = videoRect.left + (videoRect.width - width * scale) / 2;
  const top = videoRect.top + (videoRect.height - height * scale) / 2;
  const x = Math.max(0, Math.floor((guideRect.left - left) / scale - width * 0.02));
  const y = Math.max(0, Math.floor((guideRect.top - top) / scale));
  const right = Math.min(width, Math.ceil((guideRect.left + guideRect.width - left) / scale + width * 0.02));
  const bottom = Math.min(height, Math.ceil((guideRect.top + guideRect.height - top) / scale));
  if (right <= x || bottom <= y) return { x: 0, y: 0, width, height };
  return { x, y, width: right - x, height: bottom - y };
}

// One decode per attempt; the full frame also covers positioning outside the guide.
export function nfeDecodeStrategy(attempt) {
  const index = attempt % 6;
  return { fullFrame: index === 5, angle: index === 2 ? -8 : index === 4 ? 8 : 0 };
}

export function nfeDecodeDelay(durationMs) {
  // Wait AFTER decoding: at most ~6 attempts/s, lower CPU share on slower phones.
  return Math.max(160, Math.min(1000, Math.ceil(durationMs * 2)));
}
