import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Support multiple naming conventions for the service role/secret key
// Priority: SUPABASE_SECRET_KEY > SUPABASE_SERVICE_ROLE_KEY > SUPABASE_PUBLISHABLE_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

// Support multiple naming conventions for the anon/publishable key
const supabaseAnonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// JWKS URL for JWT verification (optional)
const supabaseJwksUrl = process.env.SUPABASE_JWKS_URL;

// In automated test runs, provide safe mock defaults if env variables are empty
if (process.env.NODE_ENV === "test") {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.trim() === "") {
    process.env.SUPABASE_URL = "https://test-mock.supabase.co";
  }
  if (!supabaseServiceRoleKey || supabaseServiceRoleKey.trim() === "") {
    process.env.SUPABASE_SECRET_KEY = "test-mock-service-role-key";
  }
  if (
    !process.env.AUTH_EMAIL_DOMAIN ||
    process.env.AUTH_EMAIL_DOMAIN.trim() === ""
  ) {
    process.env.AUTH_EMAIL_DOMAIN = "test.points.example.com";
  }
}

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  /**
   * AUTH_EMAIL_DOMAIN — the domain used to build fake Supabase auth emails from
   * Tanzanian phone numbers.  Format: 255712345678@<AUTH_EMAIL_DOMAIN>
   * Switch this to a real OTP flow later by updating getVerifiedPhone() only.
   */
  AUTH_EMAIL_DOMAIN: z
    .string()
    .min(1, { message: "AUTH_EMAIL_DOMAIN is required" }),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z.string().default("*"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(
    `\n❌ Configuration Error: Missing or invalid environment variables:\n${issues}\n` +
      `Please check your .env file or reference .env.example.\n`
  );
  throw new Error("Invalid environment configuration. Process aborted.");
}

export const env = {
  ...parsed.data,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey || "test-mock-service-role-key",
  SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_JWKS_URL: supabaseJwksUrl,
  JWT_SECRET: process.env.JWT_SECRET || supabaseServiceRoleKey || "alibhai-points-jwt-secret-key-2026",
};
export type Env = z.infer<typeof envSchema>;
