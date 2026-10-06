/**
 * Validates and converts Tanzanian phone numbers to E.164 format (+255XXXXXXXXX).
 *
 * Accepted formats:
 * - 07XXXXXXXX / 06XXXXXXXX (10 digits starting with 0)
 * - 7XXXXXXXX / 6XXXXXXXX (9 digits starting with 7 or 6)
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

  // 1. 07XXXXXXXX / 06XXXXXXXX (10 digits starting with 0) -> +255XXXXXXXXX
  if (/^0\d{9}$/.test(cleaned)) {
    return `+255${cleaned.slice(1)}`;
  }

  // 2. 7XXXXXXXX / 6XXXXXXXX (9 digits) -> +255XXXXXXXXX
  if (/^\d{9}$/.test(cleaned)) {
    return `+255${cleaned}`;
  }

  // 3. 255XXXXXXXXX (12 digits starting with 255) -> +255XXXXXXXXX
  if (/^255\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 4. +255XXXXXXXXX (13 chars starting with +255) -> +255XXXXXXXXX
  if (/^\+255\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export function isValidTanzanianPhoneNumber(phone: string | null | undefined): boolean {
  return toE164(phone) !== null;
}

/**
 * Derives the Supabase Auth fake email from a Tanzanian phone number.
 * Format: <255XXXXXXXXX>@<EXPO_PUBLIC_AUTH_EMAIL_DOMAIN>
 */
export function phoneToEmail(phone: string | null | undefined): string {
  const e164 = toE164(phone);
  if (!e164) {
    throw new Error(
      "Namba ya simu si sahihi. Weka 07XXXXXXXX au +255XXXXXXXXX / Invalid phone number format."
    );
  }

  const domain =
    process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN || "points.alibhai.co.tz";

  // E.164 is +255XXXXXXXXX; slice(1) yields 255XXXXXXXXX
  const localPart = e164.slice(1);
  return `${localPart}@${domain}`;
}

export const PHONE_NUMBER_ERROR_MESSAGE =
  "Weka namba sahihi ya simu (mfano: 07XXXXXXXX au +255XXXXXXXXX) / Enter a valid phone number (e.g. 07XXXXXXXX or +255XXXXXXXXX).";
