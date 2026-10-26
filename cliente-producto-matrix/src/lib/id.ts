export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const raw = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}${raw.replace(/-/g, '').slice(0, 12)}`;
}
