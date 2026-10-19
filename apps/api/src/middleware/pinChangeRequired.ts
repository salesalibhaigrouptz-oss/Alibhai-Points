import type { Request, Response, NextFunction } from "express";
import { authMiddleware } from "./auth.js";
import { sendError } from "../utils/response.js";

const allowedRoutes = new Set(["GET /me", "POST /me/change-pin"]);

export function pinChangeRequiredMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (allowedRoutes.has(`${req.method} ${req.path}`)) {
    next();
    return;
  }

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next();
    return;
  }

  authMiddleware(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    if (req.profile?.must_change_pin) {
      sendError(
        res,
        403,
        "PIN_CHANGE_REQUIRED",
        "You must change your PIN before continuing."
      );
      return;
    }

    next();
  });
}
