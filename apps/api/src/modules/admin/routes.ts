import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { validateBody } from "../../middleware/validate.js";
import { adminWriteLimiter } from "../../middleware/rateLimit.js";
import { sendSuccess } from "../../utils/response.js";
import { adminController } from "./controller.js";
import { adminDashboardController } from "./dashboard.controller.js";
import { adminPurchasesController } from "./purchases.controller.js";
import { adminCustomersController } from "./customers.controller.js";
import { adminRedemptionsController } from "./redemptions.controller.js";
import { adminReportsController } from "./reports.controller.js";
import { adminRulesController } from "./rules.controller.js";
import { adminAuditController } from "./audit.controller.js";
import { resetPinSchema, updateCustomerStatusSchema, voidPurchaseSchema, updatePointRulesSchema, updateLoyaltyTierSchema } from "./schema.js";
import { previewPurchaseSchema, recordPurchaseSchema } from "./purchases.schema.js";
import { cancelRedemptionSchema, directRedeemSchema } from "./redemptions.schema.js";

const router = Router();

/**
 * GET /api/admin/dashboard
 * Query: { city? }
 * Protected: Administrator role only.
 */
router.get(
  "/dashboard",
  authMiddleware,
  requireAdmin,
  adminDashboardController.getDashboardMetrics.bind(adminDashboardController)
);

/**
 * POST /api/admin/purchases/preview
 * Body: { customer, purchase_amount }
 * Protected: Administrator role only.
 */
router.post(
  "/purchases/preview",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(previewPurchaseSchema),
  adminPurchasesController.previewPurchase.bind(adminPurchasesController)
);

/**
 * POST /api/admin/purchases
 * Body: { customer, purchase_amount, idempotency_key }
 * Protected: Administrator role only.
 */
router.post(
  "/purchases",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(recordPurchaseSchema),
  adminPurchasesController.recordPurchase.bind(adminPurchasesController)
);

/**
 * GET /api/admin/purchases
 * Query: { customer?, start_date?, end_date?, page?, limit? }
 * Protected: Administrator role only.
 */
router.get(
  "/purchases",
  authMiddleware,
  requireAdmin,
  adminPurchasesController.listPurchases.bind(adminPurchasesController)
);

/**
 * POST /api/admin/purchases/:id/void
 * Body: { reason: string }
 * Protected: Administrator role only.
 */
router.post(
  "/purchases/:id/void",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(voidPurchaseSchema),
  adminPurchasesController.voidPurchase.bind(adminPurchasesController)
);

/**
 * GET /api/admin/customers/lookup
 * Query: { q } - customer ID or phone
 * Protected: Administrator role only.
 */
router.get(
  "/customers/lookup",
  authMiddleware,
  requireAdmin,
  adminCustomersController.lookupCustomer.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/cities
 * Protected: Administrator role only.
 */
router.get(
  "/customers/cities",
  authMiddleware,
  requireAdmin,
  adminCustomersController.getCustomerCities.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers
 * Query: { search?, status?, city?, tier?, near_deadline?, page?, limit? }
 * Protected: Administrator role only.
 */
router.get(
  "/customers",
  authMiddleware,
  requireAdmin,
  adminCustomersController.listCustomers.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/:customerCode
 * Protected: Administrator role only.
 */
router.get(
  "/customers/:customerCode",
  authMiddleware,
  requireAdmin,
  adminCustomersController.getCustomer.bind(adminCustomersController)
);

/**
 * PATCH /api/admin/customers/:customerCode
 * Body: { is_active: boolean }
 * Protected: Administrator role only.
 */
router.patch(
  "/customers/:customerCode",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(updateCustomerStatusSchema),
  adminCustomersController.updateCustomerStatus.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/:customerCode/purchases
 * Query: { page?, limit? }
 * Protected: Administrator role only.
 */
router.get(
  "/customers/:customerCode/purchases",
  authMiddleware,
  requireAdmin,
  adminCustomersController.getCustomerPurchases.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/:customerCode/find
 * Protected: Administrator role only.
 */
router.get(
  "/customers/:customerCode/find",
  authMiddleware,
  requireAdmin,
  adminCustomersController.findCustomer.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/:customerCode/activity
 * Protected: Administrator role only.
 */
router.get(
  "/customers/:customerCode/activity",
  authMiddleware,
  requireAdmin,
  adminCustomersController.getRecentActivity.bind(adminCustomersController)
);

/**
 * GET /api/admin/customers/:identifier/statement
 * Query: { from?, to?, format? }
 * Protected: Administrator role only.
 */
router.get(
  "/customers/:identifier/statement",
  authMiddleware,
  requireAdmin,
  adminCustomersController.getCustomerStatement.bind(adminCustomersController)
);

/**
 * POST /api/admin/customers/:customerCode/redeem
 * Body: { points }
 * Protected: Administrator role only.
 */
router.post(
  "/customers/:customerCode/redeem",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(directRedeemSchema),
  adminRedemptionsController.directRedeem.bind(adminRedemptionsController)
);

/**
 * POST /api/admin/customers/:customerCode/reset-pin
 * Body: { new_pin: string } — exactly 6 digits
 * Protected: Administrator role only. Audit-logged. PIN is never stored in logs.
 */
router.post(
  "/customers/:customerCode/reset-pin",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(resetPinSchema),
  adminController.resetPin.bind(adminController)
);

/**
 * GET /api/admin/redemptions
 * Query: { status?, page?, limit? }
 * Protected: Administrator role only.
 */
router.get(
  "/redemptions",
  authMiddleware,
  requireAdmin,
  adminRedemptionsController.listRedemptions.bind(adminRedemptionsController)
);

/**
 * GET /api/admin/redemptions/:id
 * Protected: Administrator role only.
 */
router.get(
  "/redemptions/:id",
  authMiddleware,
  requireAdmin,
  adminRedemptionsController.getRedemption.bind(adminRedemptionsController)
);

/**
 * POST /api/admin/redemptions/:id/complete
 * Protected: Administrator role only.
 */
router.post(
  "/redemptions/:id/complete",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  adminRedemptionsController.completeRedemption.bind(adminRedemptionsController)
);

/**
 * POST /api/admin/redemptions/:id/cancel
 * Body: { reason? }
 * Protected: Administrator role only.
 */
router.post(
  "/redemptions/:id/cancel",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(cancelRedemptionSchema),
  adminRedemptionsController.cancelRedemption.bind(adminRedemptionsController)
);

/**
 * GET /api/admin/reports/summary
 * Query: { from?, to? }
 * Protected: Administrator role only.
 */
router.get(
  "/reports/summary",
  authMiddleware,
  requireAdmin,
  adminReportsController.getSummaryReport.bind(adminReportsController)
);

/**
 * GET /api/admin/tiers
 * Protected: Administrator role only.
 */
router.get(
  "/tiers",
  authMiddleware,
  requireAdmin,
  adminRulesController.getLoyaltyTiers.bind(adminRulesController)
);

/**
 * GET /api/admin/rules
 * Protected: Administrator role only.
 */
router.get(
  "/rules",
  authMiddleware,
  requireAdmin,
  adminRulesController.getCurrentRule.bind(adminRulesController)
);

/**
 * PUT /api/admin/rules
 * Body: { amount_per_point, redemption_wait_days, inactivity_days }
 * Protected: Administrator role only.
 */
router.put(
  "/rules",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(updatePointRulesSchema),
  adminRulesController.updateRule.bind(adminRulesController)
);

/**
 * PUT /api/admin/tiers/:tierId
 * Body: { min_lifetime_purchases, point_value_tzs }
 * Protected: Administrator role only.
 */
router.put(
  "/tiers/:tierId",
  authMiddleware,
  requireAdmin,
  adminWriteLimiter,
  validateBody(updateLoyaltyTierSchema),
  adminRulesController.updateLoyaltyTier.bind(adminRulesController)
);

/**
 * GET /api/admin/audit-logs
 * Query: { admin?, action?, from?, to?, page?, page_size? }
 * Protected: Administrator role only.
 */
router.get(
  "/audit-logs",
  authMiddleware,
  requireAdmin,
  adminAuditController.getAuditLogs.bind(adminAuditController)
);

export default router;
