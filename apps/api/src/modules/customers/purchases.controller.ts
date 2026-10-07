import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";

export class CustomerPurchasesController {
  /**
   * GET /api/customer/me/points
   *
   * Returns points summary for the authenticated customer.
   * Calls get_points_summary RPC which returns:
   * - total, redeemable, waiting, requested, redeemed, expired
   * - next unlock date, status, activity deadline, days left
   */
  async getPointsSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = req.customer;
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      const { data, error } = await supabase.rpc("get_points_summary", {
        p_customer_id: customer.id,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from get_points_summary");
      }

      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customer/me/purchases
   *
   * Returns purchases for the authenticated customer, paginated, newest first.
   */
  async getCustomerPurchases(
    req: Request<{}, {}, {}, { page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = req.customer;
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      const { page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      const { data, error, count } = await supabase
        .from("purchases")
        .select(`
          id,
          transaction_reference,
          purchase_amount,
          points_earned,
          amount_per_point_used,
          status,
          purchased_at,
          created_at
        `, { count: "exact" })
        .eq("customer_id", customer.id)
        .order("purchased_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      sendSuccess(res, {
        purchases: data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          pages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerPurchasesController = new CustomerPurchasesController();
