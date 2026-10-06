import type { Response } from "express";
import type { ApiResponseError, ApiResponseSuccess } from "../types/index.js";

/**
 * Sends a successful API response { success: true, data }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: ApiResponseSuccess<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(body);
}

/**
 * Sends a standardized error API response { success: false, error: { code, message, details } }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const body: ApiResponseError = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return res.status(statusCode).json(body);
}
