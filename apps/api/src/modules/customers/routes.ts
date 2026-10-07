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
 * GET /api/customer/me/purchases
 * Query: { page?, limit? }
 * Protected: Requires authenticated user with customer role.
 */
router.get("/me/purchases", authMiddleware, requireCustomer, customerPurchasesController.getCustomerPurchases.bind(customerPurchasesController));

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
 * Query: { page?, limit? }
 * Protected: Requires authenticated user with customer role.
 */
router.get("/me/redemptions", authMiddleware, requireCustomer, customerRedemptionsController.listRedemptions.bind(customerRedemptionsController));

export default router;
