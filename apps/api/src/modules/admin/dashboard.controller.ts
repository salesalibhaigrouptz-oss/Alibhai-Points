import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";

export class AdminDashboardController {
  /**
   * GET /api/admin/dashboard
   *
   * Returns comprehensive dashboard metrics:
   * - Total customers, active and inactive customers
   * - Customers near their 25-day deadline (count)
   * - Total points issued, redeemable points, points waiting, points redeemed, points expired
   * - Total purchase value, purchases today and this month
   * - Pending redemption requests count
   */
  async getDashboardMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all metrics in parallel for better performance with safe fallbacks
      const [
        { data: customerStats },
        { data: pointStats },
        { data: purchaseStats },
        pendingRedemptionsRes,
        { data: ruleData },
      ] = await Promise.all([
        // Customer statistics
        supabase
          .from("customers")
          .select("status, last_transaction_at, created_at")
          .order("created_at", { ascending: false }),

        // Point statistics from point_lots
        supabase
          .from("point_lots")
          .select("points_earned, points_remaining, points_expired, status, redeemable_at"),

        // Purchase statistics
        supabase
          .from("purchases")
          .select("purchase_amount, status, purchased_at")
          .order("purchased_at", { ascending: false }),

        // Pending redemptions count
        supabase
          .from("point_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),

        // Active point rule for deadline calculation
        supabase
          .from("point_rules")
          .select("inactivity_days")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const safeCustomerStats = customerStats || [];
      const safePointStats = pointStats || [];
      const safePurchaseStats = purchaseStats || [];
      const pendingRedemptions = pendingRedemptionsRes?.count || 0;

      // Calculate customer statistics
      const totalCustomers = customerStats?.length || 0;
      const activeCustomers = customerStats?.filter((c: any) => c.status === "active").length || 0;
      const inactiveCustomers = totalCustomers - activeCustomers;

      // Calculate customers near deadline (within 5 days)
      const inactivityDays = ruleData?.inactivity_days || 25;
      const fiveDaysFromNow = new Date(now);
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const customersNearDeadline = customerStats?.filter((c: any) => {
        if (c.status !== "active") return false;
        const lastTransaction = c.last_transaction_at || c.created_at;
        const deadline = new Date(lastTransaction);
        deadline.setDate(deadline.getDate() + inactivityDays);
        return deadline <= fiveDaysFromNow && deadline > now;
      }).length || 0;

      // Calculate point statistics
      let totalPointsIssued = 0;
      let redeemablePoints = 0;
      let waitingPoints = 0;
      let redeemedPoints = 0;
      let expiredPoints = 0;

      pointStats?.forEach((lot: any) => {
        totalPointsIssued += lot.points_earned;
        expiredPoints += lot.points_expired;

        if (lot.status === "active") {
          if (new Date(lot.redeemable_at) <= now) {
            redeemablePoints += lot.points_remaining;
          } else {
            waitingPoints += lot.points_remaining;
          }
        }
      });

      // Calculate redeemed points from redemptions
      const { data: completedRedemptions } = await supabase
        .from("point_redemptions")
        .select("points_redeemed")
        .eq("status", "completed");

      redeemedPoints = completedRedemptions?.reduce((sum: number, r: any) => sum + r.points_redeemed, 0) || 0;

      // Calculate purchase statistics
      const totalPurchaseValue = purchaseStats?.reduce((sum: number, p: any) => {
        return p.status === "completed" ? sum + Number(p.purchase_amount) : sum;
      }, 0) || 0;

      const purchasesToday = purchaseStats?.filter((p: any) => {
        return p.status === "completed" && new Date(p.purchased_at) >= todayStart;
      }).length || 0;

      const purchaseValueToday = purchaseStats?.reduce((sum: number, p: any) => {
        return p.status === "completed" && new Date(p.purchased_at) >= todayStart
          ? sum + Number(p.purchase_amount)
          : sum;
      }, 0) || 0;

      const purchasesThisMonth = purchaseStats?.filter((p: any) => {
        return p.status === "completed" && new Date(p.purchased_at) >= monthStart;
      }).length || 0;

      const purchaseValueThisMonth = purchaseStats?.reduce((sum: number, p: any) => {
        return p.status === "completed" && new Date(p.purchased_at) >= monthStart
          ? sum + Number(p.purchase_amount)
          : sum;
      }, 0) || 0;

      const pendingRedemptionsCount = pendingRedemptions || 0;

      sendSuccess(res, {
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          inactive: inactiveCustomers,
          near_deadline: customersNearDeadline,
        },
        points: {
          total_issued: totalPointsIssued,
          redeemable: redeemablePoints,
          waiting: waitingPoints,
          redeemed: redeemedPoints,
          expired: expiredPoints,
        },
        purchases: {
          total_value: totalPurchaseValue,
          today: {
            count: purchasesToday,
            value: purchaseValueToday,
          },
          this_month: {
            count: purchasesThisMonth,
            value: purchaseValueThisMonth,
          },
        },
        redemptions: {
          pending_count: pendingRedemptionsCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();
