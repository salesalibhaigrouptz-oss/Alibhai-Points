import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, DB_ERROR_MAP, mapDbCodeToHttp } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/response.js";

/**
 * Central error handling middleware.
 * Maps application errors, Zod validation errors, and PostgreSQL database exceptions
 * to consistent HTTP responses: { success: false, error: { code, message, details? } }
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
      logger.error({ err, reqId: req.id }, `[${req.id}] Server AppError: ${err.message}`);
    }
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue?.message || "Validation failed";
    return sendError(res, 400, "VALIDATION_ERROR", message, err.format());
  }

  // 3. PostgreSQL / Supabase RPC exception codes (e.g., 'INVALID_NAME', 'NOT_ADMIN')
  if (err && typeof err === "object") {
    const errObj = err as Record<string, unknown>;
    const message = typeof errObj.message === "string" ? errObj.message : "";

    // Check if any database code from DB_ERROR_MAP is in the message
    for (const [code, mapping] of Object.entries(DB_ERROR_MAP)) {
      if (message.includes(code)) {
        return sendError(res, mapping.status, code, mapping.message);
      }
    }
  }

  // 4. Standard JavaScript Error with specific message
  if (err instanceof Error) {
    // Check if error message matches a known DB code
    const mapped = mapDbCodeToHttp(err.message);
    if (DB_ERROR_MAP[err.message]) {
      return sendError(res, mapped.status, err.message, mapped.message);
    }

    logger.error(
      {
        err: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
        reqId: req.id,
        path: req.originalUrl,
        method: req.method,
      },
      `[${req.id}] Unhandled error: ${err.message}`
    );
  } else {
    logger.error({ err, reqId: req.id }, `[${req.id}] Unknown error thrown`);
  }

  // 5. Fallback internal server error
  return sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred. Please try again later."
  );
}
