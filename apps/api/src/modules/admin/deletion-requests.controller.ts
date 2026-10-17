import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import {
  buildPaginationResult,
  parsePaginationParams,
} from "../../utils/pagination.js";
import { sendSuccess } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";

export const reviewDeletionRequestSchema = z.object({});

type ReviewStatus = "done" | "rejected";

export class AdminDeletionRequestsController {
  async listRequests(
    req: Request<
      {},
      {},
      {},
      { status?: string; page?: string; page_size?: string; limit?: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status, page, page_size, limit } = req.query;
      if (status && !["pending", "done", "rejected"].includes(status)) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid request status");
      }

      const pagination = parsePaginationParams({ page, page_size, limit });
      const requestedStatus = status || "pending";
      const query = supabase
        .from("account_deletion_requests")
        .select(
          "id, customer_id, reason, status, created_at, handled_by, handled_at",
          { count: "exact" }
        )
        .eq("status", requestedStatus)
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.page_size - 1);

      const { data, error, count } = await query;
      if (error) {
        throw new AppError(500, "DATABASE_ERROR", "Unable to load account requests");
      }

      const requests = data || [];
      const customerIds = [...new Set(requests.map((item) => item.customer_id))];
      const customerMap = new Map<
        string,
        {
          customer_code: string;
          profile_id: string;
          city: string | null;
        }
      >();
      const customerDetails = new Map<
        string,
        { full_name: string | null; phone: string | null }
      >();

      if (customerIds.length) {
        const { data: customers, error: customerError } = await supabase
          .from("customers")
          .select("id, customer_code, profile_id, city")
          .in("id", customerIds);
        if (customerError) {
          throw new AppError(500, "DATABASE_ERROR", "Unable to load request customers");
        }
        for (const customer of customers || []) {
          customerMap.set(customer.id, customer);
        }
      }

      const profileIds = [
        ...new Set(
          [...customerMap.values()].map((customer) => customer.profile_id)
        ),
      ];
      if (profileIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", profileIds);
        if (profileError) {
          throw new AppError(500, "DATABASE_ERROR", "Unable to load request profiles");
        }
        for (const profile of profiles || []) {
          customerDetails.set(profile.id, {
            full_name: profile.full_name,
            phone: profile.phone,
          });
        }
      }

      sendSuccess(res, {
        requests: requests.map((item) => {
          const customer = customerMap.get(item.customer_id);
          const details = customer
            ? customerDetails.get(customer.profile_id)
            : undefined;
          return {
            ...item,
            customer_code: customer?.customer_code || null,
            customer_name: details?.full_name || null,
            customer_phone: details?.phone || null,
            customer_city: customer?.city || null,
            requested_at: item.created_at,
          };
        }),
        pagination: buildPaginationResult(
          pagination.page,
          pagination.page_size,
          count || 0
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  async markDone(
    req: Request<{ id: string }, {}, z.infer<typeof reviewDeletionRequestSchema>>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    return this.review(req, res, next, "done");
  }

  async reject(
    req: Request<{ id: string }, {}, z.infer<typeof reviewDeletionRequestSchema>>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    return this.review(req, res, next, "rejected");
  }

  private async review(
    req: Request<{ id: string }, {}, z.infer<typeof reviewDeletionRequestSchema>>,
    res: Response,
    next: NextFunction,
    status: ReviewStatus
  ): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { data, error } = await supabase
        .from("account_deletion_requests")
        .update({
          status,
          handled_by: adminId,
          handled_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("status", "pending")
        .select("id, customer_id, reason, status, created_at, handled_by, handled_at")
        .maybeSingle();

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", "Unable to update account request");
      }
      if (!data) {
        throw new AppError(
          409,
          "REQUEST_NOT_PENDING",
          "This account request is no longer pending"
        );
      }

      const { error: auditError } = await supabase
        .from("admin_audit_logs")
        .insert({
          admin_id: adminId,
          action: "DELETION_REQUEST_HANDLED",
          entity_type: "account_deletion_request",
          entity_id: data.id,
          description: `Account deletion request ${status}`,
          metadata: { customer_id: data.customer_id, status },
        });

      if (auditError) {
        logger.error(
          { errorCode: "AUDIT_LOG_WRITE_FAILED", requestId: data.id },
          "Failed to write account deletion request audit log"
        );
        throw new AppError(
          500,
          "AUDIT_LOG_WRITE_FAILED",
          "Unable to record the account request review"
        );
      }

      sendSuccess(res, { request: data });
    } catch (error) {
      next(error);
    }
  }
}

export const adminDeletionRequestsController =
  new AdminDeletionRequestsController();
