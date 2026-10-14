import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { normalizeRecentActivity } from "../../utils/recent-activity.js";

export class CustomerPurchasesController {
  /**
   * GET /api/customer/me/points
   *
   * Returns points summary for the authenticated customer.
   * Calls get_points_summary RPC which returns all fields including TZS values.
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
   * GET /api/customer/me/recent-activity
   *
   * Returns the last 5 transactions (purchases and redemptions) for the authenticated customer.
   * Calls get_recent_activity RPC which returns at most 5 items.
   */
  async getRecentActivity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = req.customer;
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      let { data, error } = await supabase.rpc("get_recent_activity", {
        p_customer_id: customer.id,
        p_limit: 5,
      });

      if (error && /could not choose the best candidate|does not exist|PGRST202/i.test(error.message)) {
        ({ data, error } = await supabase.rpc("get_recent_activity", {
          p_customer_id: customer.id,
        }));
      }

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      sendSuccess(res, normalizeRecentActivity(data, 5));
    } catch (error) {
      next(error);
    }
  }
}

export const customerPurchasesController = new CustomerPurchasesController();
