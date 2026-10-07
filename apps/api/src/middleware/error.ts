import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, DB_ERROR_MAP, mapDbCodeToHttp } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/response.js";

/**
 * Redact sensitive information from error messages and objects
 */
function redactSensitiveData(data: any): any {
  if (!data) return data;

  const redacted = { ...data };

  // Redact phone numbers (pattern: +255XXXXXXXXX)
  if (typeof redacted.message === "string") {
    redacted.message = redacted.message.replace(/\+255\d{9}/g, "+255XXXXXXX");
  }

  // Redact tokens (JWT-like strings)
  if (typeof redacted.message === "string") {
    redacted.message = redacted.message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]");
  }

  // Redact any field named token, password, pin, secret
  const sensitiveFields = ["token", "password", "pin", "secret", "apiKey", "authorization"];
  Object.keys(redacted).forEach((key) => {
    if (sensitiveFields.some((sf) => key.toLowerCase().includes(sf))) {
      redacted[key] = "[REDACTED]";
    }
  });

  return redacted;
}

/**
 * Central error handling middleware.
 * Maps application errors, Zod validation errors, and PostgreSQL database exceptions
 * to consistent HTTP responses: { success: false, error: { code, message, details? } }
 * Never leaks stack traces or database messages to clients.
 * Logs with request ID and redacts tokens and phone numbers.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // 1. Handled AppError instances
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      const redactedErr = redactSensitiveData(err);
      logger.error(
        { err: redactedErr, reqId: req.id, path: req.originalUrl, method: req.method },
        `[${req.id}] Server AppError: ${err.message}`
      );
    }
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue?.message || "Validation failed";
    logger.warn(
      { reqId: req.id, path: req.originalUrl, validationError: err.format() },
      `[${req.id}] Validation error: ${message}`
    );
    return sendError(res, 400, "VALIDATION_ERROR", message, err.format());
  }

  // 3. PostgreSQL / Supabase RPC exception codes (e.g., 'INVALID_NAME', 'NOT_ADMIN')
  if (err && typeof err === "object") {
    const errObj = err as Record<string, unknown>;
    const message = typeof errObj.message === "string" ? errObj.message : "";

    // Check if any database code from DB_ERROR_MAP is in the message
    for (const [code, mapping] of Object.entries(DB_ERROR_MAP)) {
      if (message.includes(code)) {
        logger.warn(
          { reqId: req.id, path: req.originalUrl, dbCode: code },
          `[${req.id}] Database error: ${code}`
        );
        return sendError(res, mapping.status, code, mapping.message);
      }
    }
  }

  // 4. Standard JavaScript Error with specific message
  if (err instanceof Error) {
    // Check if error message matches a known DB code
    const mapped = mapDbCodeToHttp(err.message);
    if (DB_ERROR_MAP[err.message]) {
      logger.warn(
        { reqId: req.id, path: req.originalUrl, dbCode: err.message },
        `[${req.id}] Database error: ${err.message}`
      );
      return sendError(res, mapped.status, err.message, mapped.message);
    }

    // Log full error server-side but don't send stack trace to client
    const redactedErr = redactSensitiveData({
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    logger.error(
      {
        err: redactedErr,
        reqId: req.id,
        path: req.originalUrl,
        method: req.method,
      },
      `[${req.id}] Unhandled error: ${err.message}`
    );
  } else {
    logger.error(
      { err: redactSensitiveData(err), reqId: req.id },
      `[${req.id}] Unknown error thrown`
    );
  }

  // 5. Fallback internal server error
  return sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred. Please try again later."
  );
}
