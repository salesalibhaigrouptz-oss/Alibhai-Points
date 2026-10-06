import { Router } from "express";
import { authController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { completeRegistrationSchema } from "./schema.js";
import { authLimiter } from "../../middleware/rateLimit.js";

const router = Router();

/**
 * POST /api/auth/complete-registration
 * Body: { full_name: string }
 * Headers: Authorization: Bearer <token>
 */
router.post(
  "/complete-registration",
  authLimiter,
  authMiddleware,
  validateBody(completeRegistrationSchema),
  authController.completeRegistration.bind(authController)
);

export default router;
