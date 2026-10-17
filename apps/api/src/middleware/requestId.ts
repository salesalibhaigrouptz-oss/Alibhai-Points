import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers["x-request-id"];
  const candidate = Array.isArray(existingId) ? existingId[0] : existingId;
  const id = candidate && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(candidate)
    ? candidate
    : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
