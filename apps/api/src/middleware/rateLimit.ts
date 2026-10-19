import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

const windowMs = 15 * 60 * 1000;

const messages = {
  normal: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
  auth: {
    code: "TOO_MANY_ATTEMPTS",
    message: "Too many authentication attempts. Please wait before trying again.",
  },
  admin: {
    code: "ADMIN_RATE_LIMIT_EXCEEDED",
    message: "Too many admin operations. Please wait before trying again.",
  },
  purchases: {
    code: "ADMIN_RATE_LIMIT_EXCEEDED",
    message: "Too many purchase requests. Please wait before trying again.",
  },
  redemption: {
    code: "REDEMPTION_RATE_LIMIT_EXCEEDED",
    message: "Too many redemption requests. Please wait before trying again.",
  },
  pinChange: {
    code: "PIN_CHANGE_RATE_LIMITED",
    message: "Too many PIN change attempts. Please wait before trying again.",
  },
} as const;

type LimiterName = keyof typeof messages;
type Middleware = (req: Request, res: Response, next: NextFunction) => void;
type KeyGenerator = (req: Request) => string;

const testLimiter: Middleware = (_req, _res, next) => next();
const redis =
  env.NODE_ENV === "production"
    ? (() => {
        const url = env.UPSTASH_REDIS_REST_URL;
        const token = env.UPSTASH_REDIS_REST_TOKEN;
        if (!url || !token) {
          throw new Error("Upstash Redis credentials are required for production rate limiting");
        }
        return new Redis({ url, token });
      })()
    : undefined;

function createDevelopmentLimiter(
  name: LimiterName,
  max: number,
  keyGenerator?: KeyGenerator
): Middleware {
  return rateLimit({
    windowMs,
    max,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: messages[name] },
  });
}

function createProductionLimiter(
  name: LimiterName,
  max: number,
  keyGenerator?: KeyGenerator
): Middleware {
  if (!redis) {
    throw new Error("Upstash Redis credentials are required for production rate limiting");
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, "15 m"),
    prefix: `alibhai-points:${name}`,
  });

  return async (req, res, next) => {
    try {
      const identifier =
        keyGenerator?.(req) || req.ip || req.socket.remoteAddress;
      if (!identifier) {
        throw new Error("Unable to determine request IP for rate limiting");
      }
      const result = await limiter.limit(identifier);
      res.setHeader("RateLimit-Limit", result.limit);
      res.setHeader("RateLimit-Remaining", result.remaining);
      res.setHeader("RateLimit-Reset", Math.ceil(result.reset / 1000));

      if (!result.success) {
        res.status(429).json({ success: false, error: messages[name] });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function createLimiter(
  name: LimiterName,
  max: number,
  keyGenerator?: KeyGenerator
): Middleware {
  if (env.NODE_ENV === "test" && name !== "pinChange") return testLimiter;
  if (env.NODE_ENV !== "production") {
    const developmentMax = name === "normal" ? 1000 : max;
    return createDevelopmentLimiter(name, developmentMax, keyGenerator);
  }
  return createProductionLimiter(name, max, keyGenerator);
}

export const apiLimiter = createLimiter("normal", 100);
export const authLimiter = createLimiter("auth", 10);
export const adminWriteLimiter = createLimiter("admin", 20);
export const adminPurchasesLimiter = createLimiter("purchases", 20);
export const redemptionLimiter = createLimiter("redemption", 20);
export const pinChangeLimiter = createLimiter(
  "pinChange",
  5,
  (req) => req.user?.id || req.ip || req.socket.remoteAddress || "unknown"
);
