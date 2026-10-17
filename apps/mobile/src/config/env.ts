import { z } from "zod";
import { isAllowedApiUrl } from "./url-validation.js";

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "URL must use HTTPS");

const apiUrl = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => isAllowedApiUrl(value),
    "API URL must use HTTPS, except for a local/private-network HTTP URL during development"
  );

const optionalHttpsUrl = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  httpsUrl.optional()
);

export function isSupabaseServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) {
    return true;
  }

  const payloadPart = key.split(".")[1];
  if (!payloadPart) {
    return false;
  }

  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(paddedBase64)) as {
      role?: unknown;
    };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const schema = z.object({
  EXPO_PUBLIC_API_URL: apiUrl,
  EXPO_PUBLIC_SUPABASE_URL: httpsUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !isSupabaseServiceRoleKey(value)),
  EXPO_PUBLIC_AUTH_EMAIL_DOMAIN: z.string().trim().min(1),
  EXPO_PUBLIC_AUTH_MODE: z.enum(["pin", "whatsapp_otp"]).default("pin"),
  EXPO_PUBLIC_PRIVACY_POLICY_URL: optionalHttpsUrl,
  EXPO_PUBLIC_ACCOUNT_DELETION_URL: optionalHttpsUrl,
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_AUTH_EMAIL_DOMAIN: process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN,
  EXPO_PUBLIC_AUTH_MODE: process.env.EXPO_PUBLIC_AUTH_MODE,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  EXPO_PUBLIC_ACCOUNT_DELETION_URL:
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
});

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(`Invalid Expo environment configuration: ${missing}`);
}

export const mobileEnv = parsed.data;
