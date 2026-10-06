import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

/**
 * Middleware requiring active admin profile.
 * The role is verified against public.profiles in the database.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
  }

  if (!req.profile) {
    return next(
      new AppError(403, "NOT_ADMIN", "Access denied. Profile not found or registration incomplete.")
    );
  }

  if (!req.profile.is_active) {
    return next(
      new AppError(403, "ACCOUNT_DISABLED", "Your account has been deactivated.")
    );
  }

  if (req.profile.role !== "admin") {
    return next(
      new AppError(403, "NOT_ADMIN", "Access denied. Administrator privileges required.")
    );
  }

  next();
}
