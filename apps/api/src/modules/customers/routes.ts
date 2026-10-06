import { Router } from "express";
import { customerController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/requireCustomer.js";

const router = Router();

/**
 * GET /api/customer/me
 * Protected: Requires authenticated user with customer role.
 */
router.get("/me", authMiddleware, requireCustomer, customerController.getCustomerMe.bind(customerController));

export default router;
