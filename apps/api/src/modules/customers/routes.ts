import { Router } from "express";
import { customerController } from "./controller.js";
import { customerPurchasesController } from "./purchases.controller.js";
import { customerRedemptionsController } from "./redemptions.controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/requireCustomer.js";
import { validateBody } from "../../middleware/validate.js";
import { createRedemptionSchema } from "./redemptions.schema.js";

const router = Router();

/**
 * GET /api/customer/me
 * Protected: Requires authenticated user with customer role.
 */
router.get("/me", authMiddleware, requireCustomer, customerController.getCustomerMe.bind(customerController));

/**
 * GET /api/customer/me/points
 * Protected: Requires authenticated user with customer role.
 */
router.get("/me/points", authMiddleware, requireCustomer, customerPurchasesController.getPointsSummary.bind(customerPurchasesController));

/**
 * GET /api/customer/me/recent-activity
 * Protected: Requires authenticated user with customer role.
 * Returns the last 5 transactions (purchases and redemptions).
 */
router.get("/me/recent-activity", authMiddleware, requireCustomer, customerPurchasesController.getRecentActivity.bind(customerPurchasesController));

/**
 * POST /api/customer/me/redemptions
 * Body: { points }
 * Protected: Requires authenticated user with customer role.
 */
router.post(
  "/me/redemptions",
  authMiddleware,
  requireCustomer,
  validateBody(createRedemptionSchema),
  customerRedemptionsController.createRedemption.bind(customerRedemptionsController)
);

/**
 * GET /api/customer/me/redemptions
 * Protected: Requires authenticated user with customer role.
 */
router.get(
  "/me/redemptions",
  authMiddleware,
  requireCustomer,
  customerRedemptionsController.listRedemptions.bind(customerRedemptionsController)
);

/**
 * Compatibility aliases used by older clients and docs.
 */
router.get("/points/summary", authMiddleware, requireCustomer, customerPurchasesController.getPointsSummary.bind(customerPurchasesController));
router.post(
  "/redemptions",
  authMiddleware,
  requireCustomer,
  validateBody(createRedemptionSchema),
  customerRedemptionsController.createRedemption.bind(customerRedemptionsController)
);
router.get(
  "/redemptions",
  authMiddleware,
  requireCustomer,
  customerRedemptionsController.listRedemptions.bind(customerRedemptionsController)
);

export default router;
