import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

/**
 * Middleware requiring active customer profile.
 * The role is verified against public.profiles in the database.
 */
export function requireCustomer(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
  }

  if (!req.profile) {
    return next(
      new AppError(
        403,
        "REGISTRATION_REQUIRED",
        "Registration is not complete. Please provide your full name first."
      )
    );
  }

  if (!req.profile.is_active) {
    return next(
      new AppError(403, "ACCOUNT_DISABLED", "Your account has been deactivated.")
    );
  }

  if (req.profile.role !== "customer") {
    return next(
      new AppError(403, "FORBIDDEN", "Access restricted to customers.")
    );
  }

  next();
}
