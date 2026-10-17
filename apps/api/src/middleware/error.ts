import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, DB_ERROR_MAP, mapDbCodeToHttp } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/response.js";

/**
 * Central error handling middleware.
 * Maps application errors, Zod validation errors, and PostgreSQL database exceptions
 * to consistent HTTP responses: { success: false, error: { code, message, details? } }
 * Never leaks stack traces or database messages to clients.
 * Logs only safe request metadata and fixed error codes.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  const route = req.route?.path;

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { errorCode: err.code, reqId: req.id, route, method: req.method },
        "Server AppError"
      );
    }
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue?.message || "Validation failed";
    logger.warn(
      {
        reqId: req.id,
        route,
        issues: err.issues.map(({ code, path }) => ({ code, path })),
      },
      "Request validation failed"
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
          { reqId: req.id, route, dbCode: code },
          "Database error"
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
        { reqId: req.id, route, dbCode: err.message },
        "Database error"
      );
      return sendError(res, mapped.status, err.message, mapped.message);
    }

    logger.error(
      {
        errorType: err.name,
        reqId: req.id,
        route,
        method: req.method,
      },
      "Unhandled request error"
    );
  } else {
    logger.error({ reqId: req.id, route }, "Unknown error thrown");
  }

  // 5. Fallback internal server error
  return sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred. Please try again later."
  );
}
