import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { UpdatePointRulesInput, UpdateLoyaltyTierInput } from "./schema.js";

export class AdminRulesController {
  /**
   * GET /api/admin/tiers
   *
   * Returns all loyalty tiers.
   */
  async getLoyaltyTiers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .order("min_lifetime_purchases", { ascending: true });

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      const tiers = data?.map((tier: any) => ({
        id: tier.id,
        name: tier.name,
        min_lifetime_purchases: Number(tier.min_lifetime_purchases),
        point_value_tzs: Number(tier.point_value_tzs),
        created_at: tier.created_at,
        updated_at: tier.updated_at,
      })) || [];

      sendSuccess(res, { tiers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/rules
   *
   * Returns the current active point rule.
   */
  async getCurrentRule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { data } = await supabase
        .from("point_rules")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      const rule = data || {
        id: "default",
        name: "Default Points Rule",
        amount_per_point: 1000,
        redemption_wait_days: 90,
        inactivity_days: 25,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      sendSuccess(res, {
        id: rule.id,
        name: rule.name,
        amount_per_point: Number(rule.amount_per_point),
        redemption_wait_days: rule.redemption_wait_days,
        inactivity_days: rule.inactivity_days,
        is_active: rule.is_active,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/rules
   *
   * Updates the point rule for FUTURE purchases only.
   * Calls rpc update_point_rule which creates a new active rule.
   * Old purchases and lots keep their original values.
   */
  async updateRule(
    req: Request<{}, {}, UpdatePointRulesInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { amount_per_point, redemption_wait_days, inactivity_days } = req.body;

      const { data, error } = await supabase.rpc("update_point_rule", {
        p_admin_id: adminUser.id,
        p_amount_per_point: amount_per_point,
        p_wait_days: redemption_wait_days,
        p_inactivity_days: inactivity_days,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from update_point_rule");
      }

      const result = data as { ok: boolean; rule_id: string };

      if (!result.ok) {
        throw new AppError(400, "RULE_UPDATE_FAILED", "Failed to update point rule");
      }

      // Fetch the new active rule to return it
      const { data: newRule, error: fetchError } = await supabase
        .from("point_rules")
        .select("*")
        .eq("id", result.rule_id)
        .single();

      if (fetchError) {
        // Non-fatal: return success even if we can't fetch the new rule
        sendSuccess(res, {
          message: "Point rule updated successfully",
          rule_id: result.rule_id,
        });
        return;
      }

      sendSuccess(res, {
        message: "Point rule updated successfully",
        rule: {
          id: newRule.id,
          name: newRule.name,
          amount_per_point: Number(newRule.amount_per_point),
          redemption_wait_days: newRule.redemption_wait_days,
          inactivity_days: newRule.inactivity_days,
          is_active: newRule.is_active,
          created_at: newRule.created_at,
          updated_at: newRule.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/tiers/:tierId
   *
   * Updates a loyalty tier.
   * Calls rpc update_loyalty_tier.
   */
  async updateLoyaltyTier(
    req: Request<{ tierId: string }, {}, UpdateLoyaltyTierInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { tierId } = req.params;
      const { min_lifetime_purchases, point_value_tzs } = req.body;

      const { data, error } = await supabase.rpc("update_loyalty_tier", {
        p_admin_id: adminUser.id,
        p_tier_id: tierId,
        p_min_lifetime_purchases: min_lifetime_purchases,
        p_point_value_tzs: point_value_tzs,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from update_loyalty_tier");
      }

      const result = data as { ok: boolean; code?: string };

      if (!result.ok) {
        if (result.code === "TIER_ORDER_VIOLATION") {
          throw new AppError(400, "TIER_ORDER_VIOLATION", "Tier order violation: min_lifetime_purchases must be unique");
        }
        throw new AppError(400, "TIER_UPDATE_FAILED", "Failed to update loyalty tier");
      }

      sendSuccess(res, {
        message: "Loyalty tier updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminRulesController = new AdminRulesController();
