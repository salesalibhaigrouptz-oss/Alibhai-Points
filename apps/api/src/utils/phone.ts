import type { User } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

/**
 * Normalizes Tanzanian phone numbers to E.164 (+255XXXXXXXXX).
 * Accepts:
 *   - 07XXXXXXXX / 06XXXXXXXX (10 digits starting with 0)
 *   - 7XXXXXXXX / 6XXXXXXXX   (9 digits starting with 7 or 6)
 *   - 255XXXXXXXXX            (12 digits starting with 255)
 *   - +255XXXXXXXXX           (E.164 standard)
 * 
 * Throws AppError(400, 'INVALID_PHONE') if the input cannot be normalized.
 */
export function toE164(raw: string): string {
  if (!raw || typeof raw !== "string") {
    throw new AppError(400, "INVALID_PHONE", "Phone number is required");
  }

  // Strip non-digit characters
  const digits = raw.replace(/\D/g, "");

  // Case 1: 255 followed by 9 digits (12 digits total)
  if (digits.startsWith("255") && digits.length === 12) {
    return `+${digits}`;
  }

  // Case 2: 0 followed by 9 digits (10 digits total, e.g. 0712345678 or 0612345678)
  if (digits.startsWith("0") && digits.length === 10) {
    return `+255${digits.slice(1)}`;
  }

  // Case 3: 9 digits starting with 6 or 7 (or any valid 9-digit Tanzanian local number)
  if (digits.length === 9) {
    return `+255${digits}`;
  }

  throw new AppError(
    400,
    "INVALID_PHONE",
    "Invalid Tanzanian phone format. Must be 07XXXXXXXX, 7XXXXXXXX, 255XXXXXXXXX, or +255XXXXXXXXX"
  );
}

/**
 * Safe phone normalization check that returns boolean
 */
export function isValidTanzanianPhone(phone: string): boolean {
  try {
    toE164(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * getVerifiedPhone — derives the verified E.164 phone number from a Supabase Auth user.
 *
 * TEMPORARY (phone + PIN flow):
 *   Supabase emails are fake: 255712345678@<AUTH_EMAIL_DOMAIN>
 *   The local-part IS the phone in 255XXXXXXXXX format; we prefix '+' to get E.164.
 *
 * TO SWITCH BACK to real OTP later:
 *   Replace the body with: return toE164(user.phone ?? "");
 *
 * Throws AppError(400, 'INVALID_EMAIL_FORMAT') when the user's email does not
 * match the expected fake-email pattern.
 */
export function getVerifiedPhone(user: User): string {
  const email = user.email ?? "";
  const expectedSuffix = `@${env.AUTH_EMAIL_DOMAIN}`;

  if (!email.endsWith(expectedSuffix)) {
    throw new AppError(
      400,
      "INVALID_EMAIL_FORMAT",
      `User email does not match the expected phone-derived format (*@${env.AUTH_EMAIL_DOMAIN})`
    );
  }

  // Local-part must be exactly 255 followed by 9 digits (e.g. 255712345678)
  const localPart = email.slice(0, -expectedSuffix.length);
  if (!/^255\d{9}$/.test(localPart)) {
    throw new AppError(
      400,
      "INVALID_EMAIL_FORMAT",
      "Email local-part does not encode a valid Tanzanian phone number (expected 255XXXXXXXXX)"
    );
  }

  return `+${localPart}`; // +255XXXXXXXXX
}
