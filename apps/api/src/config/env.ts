import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// In automated test runs, provide safe mock defaults if env variables are empty
if (process.env.NODE_ENV === "test") {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.trim() === "") {
    process.env.SUPABASE_URL = "https://test-mock.supabase.co";
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === ""
  ) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-mock-service-role-key";
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
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: "SUPABASE_SERVICE_ROLE_KEY is required" }),
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

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
