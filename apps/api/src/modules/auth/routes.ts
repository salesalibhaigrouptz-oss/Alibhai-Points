import { Router } from "express";
import { authController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { completeRegistrationSchema, signupSchema, loginSchema } from "./schema.js";
import { authLimiter } from "../../middleware/rateLimit.js";

const router = Router();

/**
 * POST /api/auth/login
 * Body: { phone: string, pin: string }
 */
router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  authController.login.bind(authController)
);

/**
 * POST /api/auth/signup
 * Body: { fullName: string, phone: string, pin: string }
 */
router.post(
  "/signup",
  authLimiter,
  validateBody(signupSchema),
  authController.signup.bind(authController)
);

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
