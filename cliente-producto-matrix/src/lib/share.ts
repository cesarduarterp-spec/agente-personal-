import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { State } from '../types';
import { makeEnvelope, parseState, type ParseResult } from './schema';

export const SHARE_PARAM = 's';

/** Serializa el estado → lz-string → base64 URL-safe. */
export function encodeShare(data: State): string {
  return compressToEncodedURIComponent(JSON.stringify(makeEnvelope(data)));
}

export function decodeShare(encoded: string): ParseResult {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return { ok: false, error: 'El enlace está incompleto o dañado' };
    return parseState(JSON.parse(json));
  } catch {
    return { ok: false, error: 'El enlace está incompleto o dañado' };
  }
}

export function buildShareUrl(data: State, base = window.location.href): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set(SHARE_PARAM, encodeShare(data));
  return url.toString();
}

export function readShareParam(): string | null {
  return new URLSearchParams(window.location.search).get(SHARE_PARAM);
}

export function clearShareParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState(null, '', url.toString());
}
