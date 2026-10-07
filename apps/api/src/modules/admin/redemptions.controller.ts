import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { mapDbCodeToHttp } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { CancelRedemptionInput, DirectRedeemInput } from "./redemptions.schema.js";

export class AdminRedemptionsController {
  /**
   * GET /api/admin/redemptions
   *
   * List redemptions with optional status filter and pagination.
   * Pending requests are shown first.
   */
  async listRedemptions(
    req: Request<{}, {}, {}, { status?: string; page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { status, page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      let query = supabase
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
          cancel_reason,
          customers!inner (
            customer_code,
            initials,
            profiles!inner (
              full_name,
              phone
            )
          )
        `, { count: "exact" })
        .order("redeemed_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (status && ["pending", "completed", "cancelled"].includes(status)) {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      // Sort pending requests first
      const sortedData = data?.sort((a: any, b: any) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });

      sendSuccess(res, {
        redemptions: sortedData,
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

  /**
   * GET /api/admin/redemptions/:id
   *
   * Get details for a specific redemption, including the lots used.
   */
  async getRedemption(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { id } = req.params;

      const { data, error } = await supabase
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
          cancel_reason,
          customers!inner (
            customer_code,
            initials,
            profiles!inner (
              full_name,
              phone
            )
          ),
          point_redemption_items (
            id,
            points_used,
            point_lots (
              id,
              points_earned,
              points_remaining,
              earned_at,
              redeemable_at
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new AppError(404, "REDEMPTION_NOT_FOUND", "Redemption record not found");
      }

      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/redemptions/:id/complete
   *
   * Completes a pending redemption request.
   * Points are used for good (already reserved when request was created).
   */
  async completeRedemption(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { id } = req.params;

      const { data, error } = await supabase.rpc("complete_redemption", {
        p_redemption_id: id,
        p_admin_id: adminUser.id,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from complete_redemption");
      }

      const result = data as {
        ok: boolean;
        code?: string;
        status?: string;
        reference?: string;
      };

      if (!result.ok) {
        if (result.code) {
          const mapped = mapDbCodeToHttp(result.code);
          throw new AppError(mapped.status, result.code, mapped.message);
        }
        throw new AppError(400, "COMPLETION_FAILED", "Failed to complete redemption");
      }

      sendSuccess(res, {
        status: result.status,
        reference: result.reference,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/redemptions/:id/cancel
   *
   * Cancels a redemption request (pending or completed).
   * Points are returned to their lots, unless the customer became inactive.
   */
  async cancelRedemption(
    req: Request<{ id: string }, {}, CancelRedemptionInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { id } = req.params;
      const { reason } = req.body;

      const { data, error } = await supabase.rpc("cancel_redemption", {
        p_redemption_id: id,
        p_admin_id: adminUser.id,
        p_reason: reason,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from cancel_redemption");
      }

      const result = data as {
        ok: boolean;
        code?: string;
        status?: string;
      };

      if (!result.ok) {
        if (result.code) {
          const mapped = mapDbCodeToHttp(result.code);
          throw new AppError(mapped.status, result.code, mapped.message);
        }
        throw new AppError(400, "CANCELLATION_FAILED", "Failed to cancel redemption");
      }

      sendSuccess(res, {
        status: result.status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/customers/:customerCode/redeem
   *
   * Directly deduct points for a customer at the counter.
   * Points are taken from the oldest eligible lots (FIFO) immediately.
   */
  async directRedeem(
    req: Request<{ customerCode: string }, {}, DirectRedeemInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;
      const { points } = req.body;

      // First, get the customer ID from customer_code
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (customerError || !customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const { data, error } = await supabase.rpc("create_redemption", {
        p_customer_id: customerData.id,
        p_points: points,
        p_admin_id: adminUser.id,
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
        throw new AppError(400, "REDEMPTION_FAILED", "Failed to deduct points");
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
}

export const adminRedemptionsController = new AdminRedemptionsController();
