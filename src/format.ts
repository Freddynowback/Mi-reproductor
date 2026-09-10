export function formatTime(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function cleanTitle(value: string | null | undefined): string {
  if (!value) {
    return 'Canción sin nombre';
  }

  return value.replace(/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i, '').trim();
}

export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
