import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { mapDbCodeToHttp } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { CreateRedemptionInput } from "./redemptions.schema.js";

export class CustomerRedemptionsController {
  /**
   * POST /api/customer/me/redemptions
   *
   * Creates a pending redemption request for the authenticated customer.
   * Points are reserved immediately from the oldest eligible lots (FIFO).
   */
  async createRedemption(
    req: Request<{}, {}, CreateRedemptionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = req.customer;
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      const { points } = req.body;

      const { data, error } = await supabase.rpc("create_redemption", {
        p_customer_id: customer.id,
        p_points: points,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from create_redemption");
      }

      const result = data as {
        ok: boolean;
        code?: string;
        redemption_id?: string;
        reference?: string;
        status?: string;
        points?: number;
        redeemable_points?: number;
      };

      if (!result.ok) {
        if (result.code) {
          const mapped = mapDbCodeToHttp(result.code);
          throw new AppError(mapped.status, result.code, mapped.message);
        }
        throw new AppError(400, "REDEMPTION_FAILED", "Failed to create redemption request");
      }

      sendSuccess(res, {
        redemption_id: result.redemption_id,
        reference: result.reference,
        status: result.status,
        points: result.points,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customer/me/redemptions
   *
   * Returns redemption history for the authenticated customer.
   */
  async listRedemptions(
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
        .from("point_redemptions")
        .select(`
          id,
          redemption_reference,
          points_redeemed,
          source,
          status,
          redeemed_at,
          completed_at,
          cancelled_at,
          cancel_reason
        `, { count: "exact" })
        .eq("customer_id", customer.id)
        .order("redeemed_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      sendSuccess(res, {
        redemptions: data,
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

export const customerRedemptionsController = new CustomerRedemptionsController();
