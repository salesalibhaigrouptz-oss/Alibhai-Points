import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  /**
   * AUTH_EMAIL_DOMAIN — the domain used to build fake Supabase auth emails from
   * Tanzanian phone numbers.  Format: 255712345678@<AUTH_EMAIL_DOMAIN>
   * Switch this to a real OTP flow later by updating getVerifiedPhone() only.
   */
  AUTH_EMAIL_DOMAIN: z
    .string()
    .min(1, { message: "AUTH_EMAIL_DOMAIN is required" }),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z.string().default(""),
  MIN_APP_VERSION: z.string().default("1.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).superRefine((values, context) => {
  if (values.NODE_ENV === "production") {
    if (!values.UPSTASH_REDIS_REST_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "UPSTASH_REDIS_REST_URL is required in production",
      });
    }
    if (!values.UPSTASH_REDIS_REST_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_TOKEN"],
        message: "UPSTASH_REDIS_REST_TOKEN is required in production",
      });
    }
  } else if (
    Boolean(values.UPSTASH_REDIS_REST_URL) !==
    Boolean(values.UPSTASH_REDIS_REST_TOKEN)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["UPSTASH_REDIS_REST_TOKEN"],
      message: "Provide both Upstash Redis credentials or neither",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
