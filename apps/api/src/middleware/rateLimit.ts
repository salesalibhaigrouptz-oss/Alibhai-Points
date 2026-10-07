import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Standard API rate limiter.
 * In test environment, rate limiting is relaxed to avoid blocking automated tests.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "test" ? 10000 : 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later.",
    },
  },
});

/**
 * Strict rate limiter for /api/auth/* endpoints.
 * 10 attempts per 15 minutes in production — brute-force resistant for PIN logins.
 * Relaxed to 10,000 in test mode so automated tests are not blocked.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "test" ? 10000 : 10, // 10 attempts per 15 minutes in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message: "Too many authentication attempts. Please wait a moment before trying again.",
    },
  },
});

/**
 * Strict rate limiter for admin write operations (POST, PUT, PATCH, DELETE).
 * 20 requests per 15 minutes in production.
 * Relaxed in test mode.
 */
export const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "test" ? 10000 : 20, // 20 admin write requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "ADMIN_RATE_LIMIT_EXCEEDED",
      message: "Too many admin operations. Please wait a moment before trying again.",
    },
  },
});
