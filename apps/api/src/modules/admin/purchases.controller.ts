import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
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

      let tierBefore = result.tier_before || result.customer_tier || result.tier;
      let tierAfter = result.tier_after;
      if (!tierBefore) {
        try {
          const { data: custData } = await supabase
            .from("customers")
            .select("tier_id, loyalty_tiers(name)")
            .eq("customer_code", customerCode)
            .maybeSingle();
          tierBefore = (custData as any)?.loyalty_tiers?.name || "Bronze";
        } catch {
          tierBefore = "Bronze";
        }
      }
      if (!tierAfter) {
        tierAfter = tierBefore;
      }

      sendSuccess(res, {
        ...data,
        customer_name: result.customer_name,
        customer_status: result.customer_status,
        points_earned: result.points_earned ?? result.points_to_earn,
        points_to_earn: result.points_to_earn ?? result.points_earned,
        amount_per_point: result.amount_per_point,
        tier_before: tierBefore,
        tier_after: tierAfter,
        tier_will_change: result.tier_will_change ?? (tierBefore !== tierAfter),
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

      // Try calling RPC first (with p_customer_code, then p_identifier)
      let rpcResult: any = null;
      let rpcError: any = null;

      try {
        const { data, error } = await supabase.rpc("record_purchase", {
          p_customer_code: customerCode,
          p_amount: purchase_amount,
          p_admin_id: adminUser.id,
          p_idempotency_key: idempotency_key,
        });
        rpcResult = data;
        rpcError = error;
      } catch (e) {
        rpcError = e;
      }

      if (rpcError && (rpcError.code === "PGRST202" || String(rpcError.message).includes("schema cache"))) {
        try {
          const { data, error } = await supabase.rpc("record_purchase", {
            p_identifier: customerCode,
            p_amount: purchase_amount,
            p_admin_id: adminUser.id,
            p_idempotency_key: idempotency_key,
          });
          rpcResult = data;
          rpcError = error;
        } catch (e) {
          rpcError = e;
        }
      }

      // Check if RPC failed due to database missing function/extension error (e.g. gen_random_bytes or schema cache mismatch)
      const isDbFunctionError =
        rpcError &&
        (rpcError.code === "PGRST202" ||
         rpcError.code === "42883" ||
         String(rpcError.message).includes("schema cache") ||
         String(rpcError.message).includes("gen_random_bytes") ||
         String(rpcError.message).includes("does not exist"));

      if (rpcError && !isDbFunctionError) {
        throw new AppError(500, "RPC_ERROR", rpcError.message);
      }

      if (rpcResult && typeof rpcResult === "object" && !isDbFunctionError) {
        if (!rpcResult.ok) {
          if (rpcResult.code === "CUSTOMER_NOT_FOUND") {
            throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
          }
          if (rpcResult.code === "CUSTOMER_DISABLED") {
            throw new AppError(403, "CUSTOMER_DISABLED", "Customer profile is deactivated");
          }
          throw new AppError(400, "PURCHASE_FAILED", "Failed to record purchase");
        }

        let tierAfter = rpcResult.tier_after || rpcResult.customer_tier || rpcResult.tier;
        if (!tierAfter) {
          try {
            const { data: custData } = await supabase
              .from("customers")
              .select("tier_id, loyalty_tiers(name)")
              .eq("customer_code", customerCode)
              .maybeSingle();
            tierAfter = (custData as any)?.loyalty_tiers?.name || "Bronze";
          } catch {
            tierAfter = "Bronze";
          }
        }

        sendSuccess(res, {
          ...rpcResult,
          reference: rpcResult.transaction_reference || rpcResult.reference,
          transaction_reference: rpcResult.transaction_reference || rpcResult.reference,
          points_earned: rpcResult.points_earned,
          new_balance: rpcResult.points_balance ?? rpcResult.new_balance,
          points_balance: rpcResult.points_balance ?? rpcResult.new_balance,
          customer_status: rpcResult.customer_status,
          duplicate: rpcResult.duplicate ?? false,
          purchase_id: rpcResult.purchase_id,
          tier_after: tierAfter,
        });
        return;
      }

      // Fallback: If RPC failed due to database function/extension issues (e.g. gen_random_bytes missing in DB),
      // perform the purchase recording directly using the Supabase client
      if (idempotency_key) {
        const { data: existing } = await supabase
          .from("purchases")
          .select("id, transaction_reference, points_earned, customer_id")
          .eq("idempotency_key", idempotency_key)
          .maybeSingle();

        if (existing) {
          const { data: cust } = await supabase
            .from("customers")
            .select("points_balance, status, tier_id, loyalty_tiers(name)")
            .eq("id", existing.customer_id)
            .maybeSingle();

          sendSuccess(res, {
            ok: true,
            reference: existing.transaction_reference,
            transaction_reference: existing.transaction_reference,
            points_earned: existing.points_earned,
            new_balance: cust?.points_balance ?? 0,
            points_balance: cust?.points_balance ?? 0,
            customer_status: cust?.status ?? "active",
            duplicate: true,
            purchase_id: existing.id,
            tier_after: (cust as any)?.loyalty_tiers?.name || "Bronze",
          });
          return;
        }
      }

      let { data: customerData } = await supabase
        .from("customers")
        .select("id, profile_id, customer_code, status, points_balance, lifetime_purchase_total, tier_id")
        .eq("customer_code", customerCode)
        .maybeSingle();

      if (!customerData) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", customerCode)
          .maybeSingle();

        if (prof?.id) {
          const { data: custByProf } = await supabase
            .from("customers")
            .select("id, profile_id, customer_code, status, points_balance, lifetime_purchase_total, tier_id")
            .eq("profile_id", prof.id)
            .maybeSingle();
          customerData = custByProf;
        }
      }

      if (!customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const { data: profData } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", customerData.profile_id)
        .maybeSingle();

      if (!profData || !profData.is_active) {
        throw new AppError(403, "CUSTOMER_DISABLED", "Customer profile is deactivated");
      }

      const { data: rule } = await supabase
        .from("point_rules")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (!rule) {
        throw new AppError(500, "NO_ACTIVE_RULE", "No active point rule found");
      }

      try {
        await supabase.rpc("apply_inactivity_if_due", { p_customer_id: customerData.id });
      } catch {}

      const pointsEarned = Math.floor(purchase_amount / rule.amount_per_point);
      const now = new Date();
      const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, "");
      const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const reference = `TXN-${yymmdd}-${randomSuffix}`;

      const { data: purchase, error: purchaseErr } = await supabase
        .from("purchases")
        .insert({
          customer_id: customerData.id,
          point_rule_id: rule.id,
          purchase_amount: purchase_amount,
          amount_per_point_used: rule.amount_per_point,
          points_earned: pointsEarned,
          recorded_by: adminUser.id,
          transaction_reference: reference,
          idempotency_key: idempotency_key,
          purchased_at: now.toISOString(),
          status: "completed",
        })
        .select("id")
        .single();

      if (purchaseErr || !purchase) {
        throw new AppError(500, "PURCHASE_FAILED", purchaseErr?.message || "Failed to record purchase");
      }

      if (pointsEarned > 0) {
        const waitDays = rule.redemption_wait_days || 0;
        const redeemableAt = new Date(now.getTime() + waitDays * 86400000);
        await supabase.from("point_lots").insert({
          customer_id: customerData.id,
          purchase_id: purchase.id,
          points_earned: pointsEarned,
          points_remaining: pointsEarned,
          earned_at: now.toISOString(),
          redeemable_at: redeemableAt.toISOString(),
        });
      }

      if (customerData.status === "inactive") {
        await supabase.from("customer_status_events").insert({
          customer_id: customerData.id,
          previous_status: "inactive",
          new_status: "active",
          reason: "New purchase",
          created_at: now.toISOString(),
        });
      }

      const newBalance = (customerData.points_balance || 0) + pointsEarned;
      const newLifetime = Number(customerData.lifetime_purchase_total || 0) + purchase_amount;

      let newTierId = customerData.tier_id;
      try {
        const { data: tiers } = await supabase
          .from("loyalty_tiers")
          .select("id, name, min_lifetime_purchases")
          .lte("min_lifetime_purchases", newLifetime)
          .order("min_lifetime_purchases", { ascending: false })
          .limit(1);

        if (tiers && tiers[0]?.id) {
          newTierId = tiers[0].id;
        }
      } catch {}

      const { data: updatedCustomer } = await supabase
        .from("customers")
        .update({
          last_transaction_at: now.toISOString(),
          status: "active",
          points_balance: newBalance,
          lifetime_purchase_total: newLifetime,
          tier_id: newTierId,
          updated_at: now.toISOString(),
        })
        .eq("id", customerData.id)
        .select("points_balance, status, tier_id, loyalty_tiers(name)")
        .single();

      try {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminUser.id,
          action: "PURCHASE_RECORDED",
          entity_type: "purchase",
          entity_id: purchase.id,
          description: `Purchase for ${customerData.customer_code}`,
          metadata: {
            amount: purchase_amount,
            points: pointsEarned,
            reference: reference,
          },
        });
      } catch {}

      sendSuccess(res, {
        ok: true,
        reference,
        transaction_reference: reference,
        points_earned: pointsEarned,
        new_balance: newBalance,
        points_balance: newBalance,
        customer_status: "active",
        duplicate: false,
        purchase_id: purchase.id,
        tier_after: (updatedCustomer as any)?.loyalty_tiers?.name || "Bronze",
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
