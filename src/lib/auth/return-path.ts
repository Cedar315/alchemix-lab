export function safeReturnPath(value: string | null, fallback = '/') {
  if (!value?.startsWith('/') || /[\u0000-\u0020\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://alchemix.invalid');
    return url.origin === 'https://alchemix.invalid' ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}
