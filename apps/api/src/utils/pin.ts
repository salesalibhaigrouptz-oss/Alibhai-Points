import crypto from "crypto";

/**
 * Hashes a 6-digit numeric PIN using scrypt with a unique 16-byte salt.
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext PIN against a stored "salt:hash" string using constant-time comparison.
 */
export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) {
    return false;
  }
  try {
    const [salt, key] = stored.split(":");
    const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
