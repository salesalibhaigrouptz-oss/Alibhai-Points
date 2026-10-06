import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { validateBody } from "../../middleware/validate.js";
import { sendSuccess } from "../../utils/response.js";
import { adminController } from "./controller.js";
import { resetPinSchema } from "./schema.js";

const router = Router();

/**
 * GET /api/admin/dashboard
 * Protected: Administrator role only.
 */
router.get("/dashboard", authMiddleware, requireAdmin, (_req, res) => {
  sendSuccess(res, { message: "Welcome to Admin Dashboard" });
});

/**
 * POST /api/admin/customers/:customerCode/reset-pin
 * Body: { new_pin: string } — exactly 6 digits
 * Protected: Administrator role only. Audit-logged. PIN is never stored in logs.
 */
router.post(
  "/customers/:customerCode/reset-pin",
  authMiddleware,
  requireAdmin,
  validateBody(resetPinSchema),
  adminController.resetPin.bind(adminController)
);

export default router;
