import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Vibración corta (Android/Chrome). En iPhone/Safari `navigator.vibrate` no existe:
 * no hace nada y devuelve false. El feedback visual (toast) se muestra siempre igual.
 */
export function haptic(ms = 12): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(ms);
    }
  } catch {
    /* algunos navegadores lanzan error si no hubo interacción del usuario */
  }
  return false;
}
