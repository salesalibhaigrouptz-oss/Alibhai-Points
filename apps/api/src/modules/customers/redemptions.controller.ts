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
   * Response now includes point_value_tzs and value_tzs from the current tier.
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
        point_value_tzs?: number;
        value_tzs?: number;
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
        point_value_tzs: result.point_value_tzs,
        value_tzs: result.value_tzs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customer/me/redemptions
   *
   * Lists all redemptions for the authenticated customer.
   */
  async listRedemptions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = req.customer;
      if (!customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      const { data, error } = await supabase
        .from("point_redemptions")
        .select(`
          id,
          redemption_reference,
          points_redeemed,
          status,
          redeemed_at,
          completed_at,
          cancelled_at,
          point_redemption_items (
            id,
            point_lot_id,
            points_used
          )
        `)
        .eq("customer_id", customer.id)
        .order("redeemed_at", { ascending: false });

      if (error) {
        throw new AppError(500, "DB_ERROR", error.message);
      }

      sendSuccess(res, { redemptions: data });
    } catch (error) {
      next(error);
    }
  }
}

export const customerRedemptionsController = new CustomerRedemptionsController();
