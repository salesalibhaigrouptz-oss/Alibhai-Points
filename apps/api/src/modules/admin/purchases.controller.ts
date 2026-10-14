import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { toE164 } from "../../utils/phone.js";
import type { PreviewPurchaseInput, RecordPurchaseInput } from "./purchases.schema.js";
import type { VoidPurchaseInput } from "./schema.js";

async function resolveCustomerCode(identifier: string, adminId?: string): Promise<string> {
  const trimmed = identifier.trim();
  const cleanCode = trimmed.replace(/\s+/g, "").toUpperCase();

  // If identifier is not a phone number (contains letters or not digit-formatted),
  // return customer_code directly without database lookups.
  const isLikelyPhone = /^(\+|0|\d)\d[\d\s-]{5,}$/.test(trimmed) && !/[a-zA-Z]/.test(trimmed);

  if (!isLikelyPhone) {
    return cleanCode;
  }

  // Identifier is a phone number. Try to find the customer's customer_code.
  // 1. Try find_customer RPC if adminId is provided
  if (adminId) {
    const candidates = [trimmed];
    try {
      const e164 = toE164(trimmed);
      if (!candidates.includes(e164)) candidates.unshift(e164);
    } catch {}

    for (const cand of candidates) {
      try {
        const { data } = await supabase.rpc("find_customer", {
          p_identifier: cand,
          p_admin_id: adminId,
        });
        const code = (data as any)?.customer?.customer_code || (data as any)?.customer_code;
        if (code) return code;
      } catch {}
    }
  }

  // 2. Direct fallback query if supabase.from is available
  try {
    const candidates = [trimmed];
    try {
      const e164 = toE164(trimmed);
      if (!candidates.includes(e164)) candidates.unshift(e164);
    } catch {}

    if (typeof supabase?.from === "function") {
      const profQuery = supabase.from("profiles");
      if (typeof profQuery?.select === "function") {
        for (const phone of candidates) {
          const { data: profile } = await profQuery
            .select("id")
            .eq("phone", phone)
            .maybeSingle();

          if (profile?.id) {
            const custQuery = supabase.from("customers");
            if (typeof custQuery?.select === "function") {
              const { data: byProfile } = await custQuery
                .select("customer_code")
                .eq("profile_id", profile.id)
                .maybeSingle();

              if (byProfile?.customer_code) {
                return byProfile.customer_code;
              }
            }
          }
        }
      }
    }
  } catch {}

  return cleanCode;
}

export class AdminPurchasesController {
  /**
   * POST /api/admin/purchases/preview
   *
   * Preview a purchase without saving it.
   * Returns tier information and points that WOULD be earned.
   */
  async previewPurchase(
    req: Request<{}, {}, PreviewPurchaseInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      // Check that the user is an admin
      if (req.profile?.role !== "admin") {
        throw new AppError(403, "NOT_ADMIN", "Access denied. Administrator privileges required.");
      }

      const { customer, purchase_amount } = req.body;
      const customerCode = await resolveCustomerCode(customer, adminUser.id);

      const { data, error } = await supabase.rpc("preview_purchase", {
        p_customer_code: customerCode,
        p_amount: purchase_amount,
      });

      if (error) {
        if (error.message?.includes("CUSTOMER_NOT_FOUND")) {
          throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
        }
        if (error.message?.includes("INVALID_AMOUNT")) {
          throw new AppError(400, "INVALID_AMOUNT", "Invalid purchase amount");
        }
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from preview_purchase");
      }

      const result = data as any;

      if (!result.ok) {
        if (result.code === "CUSTOMER_NOT_FOUND") {
          throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
        }
        throw new AppError(400, "PREVIEW_FAILED", "Failed to preview purchase");
      }

      sendSuccess(res, {
        ...data,
        customer_name: result.customer_name,
        customer_status: result.customer_status,
        points_earned: result.points_earned ?? result.points_to_earn,
        points_to_earn: result.points_to_earn ?? result.points_earned,
        amount_per_point: result.amount_per_point,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/purchases
   *
   * Record a purchase for a customer.
   * Calls record_purchase RPC which calculates points and updates balance.
   * Idempotent: same idempotency_key returns the existing purchase without creating a duplicate.
   */
  async recordPurchase(
    req: Request<{}, {}, RecordPurchaseInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      // Check that the user is an admin
      if (req.profile?.role !== "admin") {
        throw new AppError(403, "NOT_ADMIN", "Access denied. Administrator privileges required.");
      }

      const { customer, purchase_amount, idempotency_key } = req.body;
      const customerCode = await resolveCustomerCode(customer, adminUser.id);

      const { data, error } = await supabase.rpc("record_purchase", {
        p_customer_code: customerCode,
        p_amount: purchase_amount,
        p_admin_id: adminUser.id,
        p_idempotency_key: idempotency_key,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from record_purchase");
      }

      const result = data as any;

      if (!result.ok) {
        if (result.code === "CUSTOMER_NOT_FOUND") {
          throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
        }
        if (result.code === "CUSTOMER_DISABLED") {
          throw new AppError(403, "CUSTOMER_DISABLED", "Customer profile is deactivated");
        }
        throw new AppError(400, "PURCHASE_FAILED", "Failed to record purchase");
      }

      sendSuccess(res, {
        ...data,
        reference: result.transaction_reference || result.reference,
        transaction_reference: result.transaction_reference || result.reference,
        points_earned: result.points_earned,
        new_balance: result.points_balance ?? result.new_balance,
        points_balance: result.points_balance ?? result.new_balance,
        customer_status: result.customer_status,
        duplicate: result.duplicate ?? false,
        purchase_id: result.purchase_id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/purchases
   *
   * List purchases with optional filters and pagination.
   * Filters: customer (by customer_code), date range (start_date, end_date)
   */
  async listPurchases(
    req: Request<{}, {}, {}, { customer?: string; start_date?: string; end_date?: string; page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customer, start_date, end_date, page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      let query = supabase
        .from("purchases")
        .select(`
          id,
          transaction_reference,
          purchase_amount,
          points_earned,
          amount_per_point_used,
          status,
          purchased_at,
          created_at,
          customer_id,
          customers!inner (
            customer_code,
            initials,
            profiles!inner (
              full_name
            )
          )
        `, { count: "exact" })
        .order("purchased_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (customer) {
        query = query.eq("customers.customer_code", customer.toUpperCase());
      }

      if (start_date) {
        query = query.gte("purchased_at", start_date);
      }

      if (end_date) {
        query = query.lte("purchased_at", end_date);
      }

      const { data, error, count } = await query;

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

  /**
   * POST /api/admin/purchases/:id/void
   *
   * Void a purchase using rpc void_purchase.
   * Shows clear errors when the points were already used or expired.
   */
  async voidPurchase(
    req: Request<{ id: string }, {}, VoidPurchaseInput>,
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

      const { data, error } = await supabase.rpc("void_purchase", {
        p_purchase_id: id,
        p_admin_id: adminUser.id,
        p_reason: reason,
      });

      if (error) {
        // Handle specific error codes from the RPC function
        if (error.message.includes("POINTS_ALREADY_USED_OR_EXPIRED")) {
          throw new AppError(
            400,
            "POINTS_ALREADY_USED_OR_EXPIRED",
            "Cannot void purchase: points have already been used or expired"
          );
        }
        if (error.message.includes("ALREADY_VOIDED")) {
          throw new AppError(400, "ALREADY_VOIDED", "Purchase has already been voided");
        }
        if (error.message.includes("REASON_REQUIRED")) {
          throw new AppError(400, "REASON_REQUIRED", "A reason is required to void a purchase");
        }
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from void_purchase");
      }

      const result = data as { ok: boolean; status: string };

      if (!result.ok) {
        throw new AppError(400, "VOID_FAILED", "Failed to void purchase");
      }

      sendSuccess(res, {
        message: "Purchase voided successfully",
        status: result.status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminPurchasesController = new AdminPurchasesController();
