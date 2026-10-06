import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers["x-request-id"];
  const id = (Array.isArray(existingId) ? existingId[0] : existingId) || randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
