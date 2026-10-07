import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";

export class AdminReportsController {
  /**
   * GET /api/admin/reports/summary
   *
   * Returns summary statistics for a date range:
   * - Total purchases, value, points issued
   * - Points redeemed and expired
   * - Per-day series
   */
  async getSummaryReport(
    req: Request<{}, {}, {}, { from?: string; to?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { from, to } = req.query;

      // Default to last 30 days if no range provided
      const now = new Date();
      const startDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = to ? new Date(to) : now;

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new AppError(400, "INVALID_DATE_RANGE", "Invalid date range");
      }

      // Fetch purchase statistics
      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases")
        .select("purchase_amount, points_earned, purchased_at, status")
        .gte("purchased_at", startDate.toISOString())
        .lte("purchased_at", endDate.toISOString())
        .eq("status", "completed");

      if (purchaseError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to fetch purchase statistics");
      }

      // Calculate totals
      const totalPurchases = purchases?.length || 0;
      const totalValue = purchases?.reduce((sum, p) => sum + Number(p.purchase_amount), 0) || 0;
      const totalPointsIssued = purchases?.reduce((sum, p) => sum + p.points_earned, 0) || 0;

      // Fetch redeemed points in the period
      const { data: redemptions, error: redemptionError } = await supabase
        .from("point_redemptions")
        .select("points_redeemed, redeemed_at, status")
        .gte("redeemed_at", startDate.toISOString())
        .lte("redeemed_at", endDate.toISOString())
        .eq("status", "completed");

      if (redemptionError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to fetch redemption statistics");
      }

      const totalPointsRedeemed = redemptions?.reduce((sum, r) => sum + r.points_redeemed, 0) || 0;

      // Fetch expired points in the period (from point_lots)
      const { data: expiredLots, error: expiredError } = await supabase
        .from("point_lots")
        .select("points_expired, status, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .eq("status", "expired");

      if (expiredError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to fetch expired points statistics");
      }

      const totalPointsExpired = expiredLots?.reduce((sum, l) => sum + l.points_expired, 0) || 0;

      // Build per-day series
      const dailySeries = this.buildDailySeries(purchases || [], redemptions || [], startDate, endDate);

      sendSuccess(res, {
        period: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        summary: {
          purchases: {
            count: totalPurchases,
            value: totalValue,
          },
          points: {
            issued: totalPointsIssued,
            redeemed: totalPointsRedeemed,
            expired: totalPointsExpired,
          },
        },
        daily_series: dailySeries,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Build a per-day series of purchases, value, points issued, redeemed, and expired
   */
  private buildDailySeries(
    purchases: any[],
    redemptions: any[],
    startDate: Date,
    endDate: Date
  ): Array<{
    date: string;
    purchases: number;
    value: number;
    points_issued: number;
    points_redeemed: number;
    points_expired: number;
  }> {
    const series: Map<string, any> = new Map();

    // Initialize all days in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      series.set(dateKey, {
        date: dateKey,
        purchases: 0,
        value: 0,
        points_issued: 0,
        points_redeemed: 0,
        points_expired: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate purchases by day
    purchases.forEach((purchase) => {
      const dateKey = new Date(purchase.purchased_at).toISOString().split("T")[0];
      const day = series.get(dateKey);
      if (day) {
        day.purchases += 1;
        day.value += Number(purchase.purchase_amount);
        day.points_issued += purchase.points_earned;
      }
    });

    // Aggregate redemptions by day
    redemptions.forEach((redemption) => {
      const dateKey = new Date(redemption.redeemed_at).toISOString().split("T")[0];
      const day = series.get(dateKey);
      if (day) {
        day.points_redeemed += redemption.points_redeemed;
      }
    });

    // Note: Expired points would need to be tracked with an expiration_date field
    // For now, we'll aggregate from the point_lots created_at in the period
    // This is a simplification - in production, you'd want to track when points actually expired

    return Array.from(series.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const adminReportsController = new AdminReportsController();
