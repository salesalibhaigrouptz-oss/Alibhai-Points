import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";

export const createDeletionRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export class CustomerDeletionRequestsController {
  async getPendingRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = req.customer?.id;
      if (!customerId) {
        throw new AppError(403, "NOT_A_CUSTOMER", "Customer profile is required");
      }

      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("id, reason, status, created_at")
        .eq("customer_id", customerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", "Unable to load account request");
      }

      sendSuccess(res, { request: data });
    } catch (error) {
      next(error);
    }
  }

  async createRequest(
    req: Request<{}, {}, z.infer<typeof createDeletionRequestSchema>>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = req.customer?.id;
      if (!customerId) {
        throw new AppError(403, "NOT_A_CUSTOMER", "Customer profile is required");
      }

      const { data: pendingRequest, error: pendingError } = await supabase
        .from("account_deletion_requests")
        .select("id, reason, status, created_at")
        .eq("customer_id", customerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError) {
        throw new AppError(500, "DATABASE_ERROR", "Unable to check account requests");
      }

      if (pendingRequest) {
        throw new AppError(
          409,
          "DELETION_ALREADY_REQUESTED",
          "An account deletion request is already pending"
        );
      }

      const { data, error } = await supabase
        .from("account_deletion_requests")
        .insert({
          customer_id: customerId,
          reason: req.body.reason || null,
          status: "pending",
        })
        .select("id, reason, status, created_at")
        .single();

      if (error?.code === "23505") {
        throw new AppError(
          409,
          "DELETION_ALREADY_REQUESTED",
          "An account deletion request is already pending"
        );
      }

      if (error || !data) {
        throw new AppError(500, "DATABASE_ERROR", "Unable to submit account request");
      }

      sendSuccess(res, { request: data, alreadyPending: false }, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const customerDeletionRequestsController =
  new CustomerDeletionRequestsController();
