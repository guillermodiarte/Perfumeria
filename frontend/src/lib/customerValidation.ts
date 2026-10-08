/**
 * Funciones de normalización y validación de clientes para evitar duplicados
 * de correo, teléfono y DNI/identificación.
 */

export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase();
}

export function normalizeDni(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '').trim();
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  // Quitar prefijo de país para Argentina (+549 o +54) si la longitud es mayor a 10
  if (digits.startsWith('549') && digits.length > 10) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54') && digits.length > 10) {
    digits = digits.slice(2);
  }
  // Quitar 0 inicial de código de área (ej: 0351 -> 351)
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = digits.replace(/^0+/, '');
  }
  return digits;
}

export function arePhonesEqual(p1: string | null | undefined, p2: string | null | undefined): boolean {
  const n1 = normalizePhone(p1);
  const n2 = normalizePhone(p2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  // Si ambos tienen al menos 8 dígitos significativos y uno termina en el otro
  if (n1.length >= 8 && n2.length >= 8) {
    if (n1.endsWith(n2) || n2.endsWith(n1)) return true;
  }
  return false;
}

export function areDnisEqual(d1: string | null | undefined, d2: string | null | undefined): boolean {
  const n1 = normalizeDni(d1);
  const n2 = normalizeDni(d2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}
