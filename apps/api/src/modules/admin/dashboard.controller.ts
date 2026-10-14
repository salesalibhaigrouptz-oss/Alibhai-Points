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
   * - Breakdown by city (customers, active, purchases today and this month, purchase value)
   * - Breakdown by tier (customer count)
   * Optional city filter to limit all figures to that city
   */
  async getDashboardMetrics(
    req: Request<{}, {}, {}, { city?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { city } = req.query;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Build customer query with optional city filter
      let customerQuery = supabase
        .from("customers")
        .select(`
          id,
          status,
          last_transaction_at,
          created_at,
          city,
          tier_id,
          loyalty_tiers (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (city) {
        customerQuery = customerQuery.eq("city", city);
      }

      const { data: customerStats } = await customerQuery;

      // Fetch all metrics in parallel for better performance with safe fallbacks
      const [
        { data: pointStats },
        { data: purchaseStats },
        pendingRedemptionsRes,
        { data: ruleData },
      ] = await Promise.all([
        // Point statistics from point_lots
        supabase
          .from("point_lots")
          .select("points_earned, points_remaining, points_expired, status, redeemable_at, customer_id")
          .in("customer_id", customerStats?.map((c: any) => c.id) || []),

        // Purchase statistics
        supabase
          .from("purchases")
          .select("purchase_amount, status, purchased_at, customer_id")
          .in("customer_id", customerStats?.map((c: any) => c.id) || [])
          .order("purchased_at", { ascending: false }),

        // Pending redemptions count
        supabase
          .from("point_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .in("customer_id", customerStats?.map((c: any) => c.id) || []),

        // Active point rule for deadline calculation
        supabase
          .from("point_rules")
          .select("inactivity_days")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

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
        .eq("status", "completed")
        .in("customer_id", customerStats?.map((c: any) => c.id) || []);

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

      // Calculate breakdown by city
      const cityBreakdown: Record<string, any> = {};
      customerStats?.forEach((customer: any) => {
        const customerCity = customer.city || "Unknown";
        if (!cityBreakdown[customerCity]) {
          cityBreakdown[customerCity] = {
            city: customerCity,
            customers: 0,
            active: 0,
            purchases_today: 0,
            purchases_this_month: 0,
            purchase_value_today: 0,
            purchase_value_this_month: 0,
          };
        }
        cityBreakdown[customerCity].customers += 1;
        if (customer.status === "active") {
          cityBreakdown[customerCity].active += 1;
        }
      });

      // Add purchase data to city breakdown
      purchaseStats?.forEach((purchase: any) => {
        const customer = customerStats?.find((c: any) => c.id === purchase.customer_id);
        if (customer) {
          const customerCity = customer.city || "Unknown";
          if (cityBreakdown[customerCity]) {
            if (purchase.status === "completed") {
              const purchaseDate = new Date(purchase.purchased_at);
              if (purchaseDate >= todayStart) {
                cityBreakdown[customerCity].purchases_today += 1;
                cityBreakdown[customerCity].purchase_value_today += Number(purchase.purchase_amount);
              }
              if (purchaseDate >= monthStart) {
                cityBreakdown[customerCity].purchases_this_month += 1;
                cityBreakdown[customerCity].purchase_value_this_month += Number(purchase.purchase_amount);
              }
            }
          }
        }
      });

      const cities = Object.values(cityBreakdown).sort((a: any, b: any) => a.city.localeCompare(b.city));

      // Calculate breakdown by tier
      const tierBreakdown: Record<string, any> = {};
      customerStats?.forEach((customer: any) => {
        const tierName = customer.loyalty_tiers?.name || "Unknown";
        if (!tierBreakdown[tierName]) {
          tierBreakdown[tierName] = {
            tier: tierName,
            customer_count: 0,
          };
        }
        tierBreakdown[tierName].customer_count += 1;
      });

      const tiers = Object.values(tierBreakdown).sort((a: any, b: any) => a.tier.localeCompare(b.tier));

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
        by_city: cities,
        by_tier: tiers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();
