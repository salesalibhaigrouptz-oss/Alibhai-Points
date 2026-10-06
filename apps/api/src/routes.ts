import { Router } from "express";
import { authController } from "./modules/auth/controller.js";
import authRoutes from "./modules/auth/routes.js";
import customerRoutes from "./modules/customers/routes.js";
import adminRoutes from "./modules/admin/routes.js";
import { authMiddleware } from "./middleware/auth.js";
import { sendSuccess } from "./utils/response.js";

const router = Router();

/**
 * Public Health Check Endpoint
 * GET /api/health
 */
router.get("/health", (_req, res) => {
  sendSuccess(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Alibhai Points API",
    version: "2.0.0",
  });
});

/**
 * Current User Profile / Identity Endpoint
 * GET /api/me
 * Protected by authMiddleware (validates token with Supabase and loads database profile)
 */
router.get("/me", authMiddleware, authController.getMe.bind(authController));

/**
 * Sub-module route mounts
 */
router.use("/auth", authRoutes);
router.use("/customer", customerRoutes);
router.use("/admin", adminRoutes);

export default router;
