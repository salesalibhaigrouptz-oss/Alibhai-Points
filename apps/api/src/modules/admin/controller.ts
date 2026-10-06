import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { ResetPinInput } from "./schema.js";

export class AdminController {
  /**
   * POST /api/admin/customers/:customerCode/reset-pin
   *
   * Resets a customer's PIN (Supabase Auth password).
   *
   * Rules:
   *  - new_pin must be exactly 6 digits (validated upstream by validateBody).
   *  - Resolves the customer by customerCode → profile → auth user id.
   *  - Calls supabase.auth.admin.updateUserById to set the new password.
   *  - Writes an audit log row with action PIN_RESET. The PIN is NEVER logged.
   *  - Only admins may call this endpoint (enforced by requireAdmin middleware).
   */
  async resetPin(
    req: Request<{ customerCode: string }, {}, ResetPinInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;
      const { new_pin } = req.body;

      // ── 1. Look up customer by customer_code ──────────────────────────────
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, profile_id, customer_code")
        .eq("customer_code", customerCode)
        .maybeSingle();

      if (customerError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to look up customer");
      }
      if (!customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", `Customer ${customerCode} not found`);
      }

      // ── 2. Fetch profile to confirm customer_code → auth user mapping ─────
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", customerData.profile_id)
        .maybeSingle();

      if (profileError || !profileData) {
        throw new AppError(
          500,
          "DATABASE_ERROR",
          "Failed to resolve customer auth identity"
        );
      }

      const authUserId: string = profileData.id;

      // ── 3. Update Supabase Auth password (= the PIN) ──────────────────────
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        authUserId,
        { password: new_pin }
      );

      if (updateError) {
        throw new AppError(
          500,
          "AUTH_UPDATE_FAILED",
          `Failed to reset PIN: ${updateError.message}`
        );
      }

      // ── 4. Write audit log (PIN is intentionally excluded) ────────────────
      const { error: auditError } = await supabase.from("audit_logs").insert({
        action: "PIN_RESET",
        actor_id: adminUser.id,
        target_id: authUserId,
        target_type: "customer",
        metadata: { customer_code: customerCode },
      });

      if (auditError) {
        // Non-fatal: log the failure server-side but don't roll back the reset
        console.error("[AdminController.resetPin] Audit log insert failed:", auditError.message);
      }

      sendSuccess(res, {
        message: `PIN reset successfully for customer ${customerCode}`,
        customer_code: customerCode,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
