import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-supabase-key']",
      "body.token",
      "body.phone",
      "body.pin",
      "body.otp",
      "body.otp_code",
      "body.code",
      "body.access_token",
      "body.refresh_token",
      "body.password",
      "*.token",
      "*.phone",
      "*.pin",
      "*.otp",
      "*.otp_code",
      "*.code",
      "*.service_role_key",
      "*.SUPABASE_SERVICE_ROLE_KEY",
    ],
    censor: "[REDACTED]",
  },
});
