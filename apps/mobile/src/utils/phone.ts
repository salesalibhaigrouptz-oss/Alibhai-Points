/**
 * Validates and converts Tanzanian phone numbers to E.164 format (+255XXXXXXXXX).
 *
 * Accepted formats:
 * - 07XXXXXXXX (10 digits starting with 07)
 * - 7XXXXXXXX (9 digits starting with 7)
 * - 255XXXXXXXXX (12 digits starting with 255 followed by 9 digits)
 * - +255XXXXXXXXX (13 characters starting with +255 followed by 9 digits)
 *
 * Returns +255XXXXXXXXX on success, or null for anything else.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  // Remove common punctuation and whitespace
  const cleaned = phone.trim().replace(/[\s\-()]/g, "");

  // 1. 07XXXXXXXX (10 digits starting with 07) -> +2557XXXXXXXX
  if (/^07\d{8}$/.test(cleaned)) {
    return `+255${cleaned.slice(1)}`;
  }

  // 2. 7XXXXXXXX (9 digits starting with 7) -> +2557XXXXXXXX
  if (/^7\d{8}$/.test(cleaned)) {
    return `+255${cleaned}`;
  }

  // 3. 255XXXXXXXXX (12 digits starting with 255) -> +255XXXXXXXXX
  // Matches 255 followed by 9 digits (such as 7XXXXXXXX)
  if (/^2557\d{8}$/.test(cleaned) || /^255\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 4. +255XXXXXXXXX (13 chars starting with +255) -> +255XXXXXXXXX
  if (/^\+2557\d{8}$/.test(cleaned) || /^\+255\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export function isValidTanzanianPhoneNumber(phone: string | null | undefined): boolean {
  return toE164(phone) !== null;
}

export const PHONE_NUMBER_ERROR_MESSAGE =
  "Weka namba sahihi ya WhatsApp (mfano: 07XXXXXXXX au +255XXXXXXXXX) / Enter a valid WhatsApp number (e.g. 07XXXXXXXX or +255XXXXXXXXX).";
