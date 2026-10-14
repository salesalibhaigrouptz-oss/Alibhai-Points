import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { toE164 } from "../../utils/phone.js";
import { normalizeRecentActivity } from "../../utils/recent-activity.js";
import type { UpdateCustomerStatusInput } from "./schema.js";

export class AdminCustomersController {
  /**
   * GET /api/admin/customers/cities
   *
   * Returns distinct cities with customer counts.
   */
  async getCustomerCities(
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
        .from("customers")
        .select("city")
        .not("city", "is", null);

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      // Count customers per city
      const cityCounts: Record<string, number> = {};
      data?.forEach((customer: any) => {
        if (customer.city) {
          cityCounts[customer.city] = (cityCounts[customer.city] || 0) + 1;
        }
      });

      const cities = Object.entries(cityCounts).map(([city, count]) => ({
        city,
        customer_count: count,
      })).sort((a, b) => a.city.localeCompare(b.city));

      sendSuccess(res, { cities });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers
   *
   * List customers with optional search, status, city, tier, and near_deadline filters.
   * Search: customer_code, phone, or full_name
   * city: case-insensitive exact match on customers.city
   * tier: filter by tier name
   * near_deadline=true: active customers whose deadline is within 5 days
   * Pagination: page, limit
   */
  async listCustomers(
    req: Request<{}, {}, {}, { search?: string; status?: string; city?: string; tier?: string; near_deadline?: string; page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { search, status, city, tier, near_deadline, page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      let query = supabase
        .from("customers")
        .select(`
          id,
          customer_code,
          initials,
          sequence_number,
          status,
          points_balance,
          last_transaction_at,
          city,
          tier_id,
          created_at,
          updated_at,
          profiles!inner (
            id,
            full_name,
            phone,
            is_active
          ),
          loyalty_tiers (
            id,
            name,
            min_lifetime_purchases,
            point_value_tzs
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (search) {
        const searchTerm = search.trim();
        query = query.or(`customer_code.ilike.%${searchTerm}%,profiles.full_name.ilike.%${searchTerm}%,profiles.phone.ilike.%${searchTerm}%`);
      }

      if (status && (status === "active" || status === "inactive")) {
        query = query.eq("status", status);
      }

      if (city) {
        query = query.eq("city", city);
      }

      if (tier) {
        query = query.eq("loyalty_tiers.name", tier);
      }

      if (near_deadline === "true") {
        query = query.eq("status", "active");
      }

      const { data, error, count } = await query;

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      let filteredData = data;

      if (near_deadline === "true") {
        const { data: ruleData } = await supabase
          .from("point_rules")
          .select("inactivity_days")
          .eq("is_active", true)
          .single();

        if (!ruleData) {
          throw new AppError(500, "NO_ACTIVE_RULE", "No active points rule is set");
        }

        const inactivityDays = ruleData.inactivity_days;
        const fiveDaysFromNow = new Date();
        fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

        filteredData = data?.filter((customer: any) => {
          const lastTransaction = customer.last_transaction_at || customer.created_at;
          const deadline = new Date(lastTransaction);
          deadline.setDate(deadline.getDate() + inactivityDays);
          return deadline <= fiveDaysFromNow;
        });
      }

      // Transform data to match expected format
      const transformedData = filteredData?.map((customer: any) => ({
        id: customer.id,
        customer_code: customer.customer_code,
        initials: customer.initials,
        sequence_number: customer.sequence_number,
        status: customer.status,
        points_balance: customer.points_balance,
        last_transaction_at: customer.last_transaction_at,
        city: customer.city,
        tier: customer.loyalty_tiers ? {
          id: customer.loyalty_tiers.id,
          name: customer.loyalty_tiers.name,
          min_lifetime_purchases: Number(customer.loyalty_tiers.min_lifetime_purchases),
          point_value_tzs: Number(customer.loyalty_tiers.point_value_tzs),
        } : null,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        profiles: customer.profiles,
      }));

      sendSuccess(res, {
        customers: transformedData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: near_deadline === "true" ? (filteredData?.length || 0) : (count || 0),
          pages: near_deadline === "true"
            ? Math.ceil((filteredData?.length || 0) / limitNum)
            : Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/:customerCode
   *
   * Get details for a specific customer by customer_code.
   */
  async getCustomer(
    req: Request<{ customerCode: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;

      const { data, error } = await supabase
        .from("customers")
        .select(`
          id,
          customer_code,
          initials,
          sequence_number,
          status,
          points_balance,
          last_transaction_at,
          city,
          tier_id,
          created_at,
          updated_at,
          profiles!inner (
            id,
            full_name,
            phone,
            is_active,
            created_at
          ),
          loyalty_tiers (
            id,
            name,
            min_lifetime_purchases,
            point_value_tzs
          )
        `)
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (error || !data) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const { data: purchaseAgg } = await supabase
        .from("purchases")
        .select("purchase_amount")
        .eq("customer_id", data.id)
        .eq("status", "completed");

      const lifetimePurchases = (purchaseAgg || []).reduce(
        (sum: number, row: { purchase_amount: number }) => sum + Number(row.purchase_amount || 0),
        0
      );

      const { data: ruleData } = await supabase
        .from("point_rules")
        .select("inactivity_days")
        .eq("is_active", true)
        .maybeSingle();

      const lastActivity = data.last_transaction_at || data.created_at;
      let activityDeadline: string | null = null;
      if (lastActivity && ruleData?.inactivity_days) {
        const deadline = new Date(lastActivity);
        deadline.setDate(deadline.getDate() + Number(ruleData.inactivity_days));
        activityDeadline = deadline.toISOString();
      }

      const tier = (data as any).loyalty_tiers;
      sendSuccess(res, {
        ...data,
        city: (data as any).city,
        tier: tier
          ? {
              id: tier.id,
              name: tier.name,
              min_lifetime_purchases: Number(tier.min_lifetime_purchases),
              point_value_tzs: Number(tier.point_value_tzs),
            }
          : null,
        point_value_tzs: tier ? Number(tier.point_value_tzs) : 0,
        lifetime_purchases: lifetimePurchases,
        activity_deadline: activityDeadline,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/:customerCode/purchases
   *
   * Get purchases for a specific customer, paginated, newest first.
   */
  async getCustomerPurchases(
    req: Request<{ customerCode: string }, {}, {}, { page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;
      const { page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (!customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const { data, error, count } = await supabase
        .from("purchases")
        .select(`
          id,
          transaction_reference,
          purchase_amount,
          points_earned,
          amount_per_point_used,
          status,
          purchased_at,
          created_at
        `, { count: "exact" })
        .eq("customer_id", customerData.id)
        .order("purchased_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

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
   * GET /api/admin/customers/:customerCode/redemptions
   *
   * Get redemptions for a specific customer, paginated, newest first.
   */
  async getCustomerRedemptions(
    req: Request<{ customerCode: string }, {}, {}, { page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;
      const { page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new AppError(400, "INVALID_PAGINATION", "Invalid pagination parameters");
      }

      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (!customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const { data, error, count } = await supabase
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
          cancel_reason
        `, { count: "exact" })
        .eq("customer_id", customerData.id)
        .order("redeemed_at", { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      sendSuccess(res, {
        redemptions: data,
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
   * PATCH /api/admin/customers/:customerCode
   *
   * Enable or disable a customer account (profiles.is_active).
   * A disabled user cannot log in to the API.
   */
  async updateCustomerStatus(
    req: Request<{ customerCode: string }, {}, UpdateCustomerStatusInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;
      const { is_active } = req.body;

      // Get customer profile_id
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("profile_id, customer_code")
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (customerError || !customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      // Update profile is_active status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_active })
        .eq("id", customerData.profile_id);

      if (updateError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to update customer status");
      }

      // Write audit log
      const { error: auditError } = await supabase.from("admin_audit_logs").insert({
        admin_id: adminUser.id,
        action: is_active ? "CUSTOMER_ENABLED" : "CUSTOMER_DISABLED",
        entity_type: "customer",
        entity_id: customerData.profile_id,
        description: `Customer ${customerCode} ${is_active ? "enabled" : "disabled"}`,
        metadata: { customer_code: customerCode, is_active },
      });

      if (auditError) {
        console.error("[AdminCustomersController.updateCustomerStatus] Audit log insert failed:", auditError.message);
      }

      sendSuccess(res, {
        message: `Customer ${is_active ? "enabled" : "disabled"} successfully`,
        customer_code: customerCode,
        is_active,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/lookup?q=
   *
   * Find customer by identifier (ID or phone) using the find_customer RPC function.
   * q may be a Customer ID ("AG01", "ag 01") or a phone number.
   */
  async lookupCustomer(
    req: Request<{}, {}, {}, { q?: string }>,
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

      const { q } = req.query;

      if (!q || q.trim() === "") {
        throw new AppError(400, "VALIDATION_ERROR", "Query parameter 'q' is required");
      }

      const rawQ = q.trim();
      let normalizedPhone: string | null = null;
      try {
        normalizedPhone = toE164(rawQ);
      } catch {}

      // Try with rawQ, normalizedPhone, and stripped spaces
      const candidates = [rawQ];
      if (normalizedPhone && !candidates.includes(normalizedPhone)) {
        candidates.push(normalizedPhone);
      }
      const cleanUpper = rawQ.replace(/\s+/g, "").toUpperCase();
      if (!candidates.includes(cleanUpper)) {
        candidates.push(cleanUpper);
      }

      let data: any = null;
      let error: any = null;

      // Try RPC find_customer with candidates
      for (const cand of candidates) {
        const resRpc = await supabase.rpc("find_customer", {
          p_identifier: cand,
          p_admin_id: adminUser.id,
        });
        if (resRpc.data && (resRpc.data as any).ok) {
          data = resRpc.data;
          error = null;
          break;
        }
        if (resRpc.data && !(resRpc.data as any).ok) {
          data = resRpc.data;
        }
        if (resRpc.error) {
          error = resRpc.error;
        }
      }

      // If RPC didn't find customer, fallback to direct query if tables are available
      if (!data || !data.ok) {
        try {
          if (typeof supabase?.from === "function") {
            const custTable = supabase.from("customers");
            if (typeof custTable?.select === "function") {
              const { data: byCode } = await custTable
                .select("*, profiles(*), loyalty_tiers(*)")
                .eq("customer_code", cleanUpper)
                .maybeSingle();

              let foundCust = byCode;

              if (!foundCust) {
                const profTable = supabase.from("profiles");
                if (typeof profTable?.select === "function") {
                  for (const cand of candidates) {
                    const { data: profile } = await profTable
                      .select("id")
                      .eq("phone", cand)
                      .maybeSingle();

                    if (profile?.id) {
                      const { data: byProfile } = await custTable
                        .select("*, profiles(*), loyalty_tiers(*)")
                        .eq("profile_id", profile.id)
                        .maybeSingle();
                      if (byProfile) {
                        foundCust = byProfile;
                        break;
                      }
                    }
                  }
                }
              }

              if (foundCust) {
                const prof = foundCust.profiles || {};
                const tier = foundCust.loyalty_tiers || {};
                data = {
                  ok: true,
                  customer: foundCust,
                  profile: prof,
                  tier: tier,
                };
                error = null;
              }
            }
          }
        } catch {}
      }

      if (error && (!data || !data.ok)) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      const result = data as { ok: boolean; code?: string };

      if (!result.ok) {
        if (result.code === "CUSTOMER_NOT_FOUND") {
          throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
        }
        throw new AppError(400, "LOOKUP_FAILED", "Failed to lookup customer");
      }

      // Flatten data for frontend and tests while preserving nested structures
      const cust = data.customer || data;
      const prof = data.profile || {};
      const tierObj = data.tier || {};

      const responseData = {
        ...data,
        id: cust.id || data.customer_id || data.id,
        customer_id: cust.id || data.customer_id,
        customer_code: cust.customer_code || data.customer_code,
        full_name: prof.full_name || data.full_name || cust.full_name,
        phone: prof.phone || data.phone || cust.phone,
        city: cust.city || data.city,
        status: cust.status || data.status,
        tier: typeof data.tier === "string" ? data.tier : (tierObj.name || data.tier_name || "Bronze"),
        tier_id: cust.tier_id || data.tier_id || tierObj.id,
        point_value_tzs: tierObj.point_value_tzs ?? data.point_value_tzs ?? 30,
        points_balance: cust.points_balance ?? data.points_balance ?? 0,
        lifetime_purchases: cust.lifetime_purchases ?? data.lifetime_purchases ?? 0,
        last_transaction_at: cust.last_transaction_at || data.last_transaction_at,
        last_purchase_at: cust.last_transaction_at || data.last_purchase_at,
        activity_deadline: cust.activity_deadline || data.activity_deadline,
      };

      sendSuccess(res, responseData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/:customerCode/find
   *
   * Find customer by identifier using the find_customer RPC function.
   */
  async findCustomer(
    req: Request<{ customerCode: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;

      const { data, error } = await supabase.rpc("find_customer", {
        p_identifier: customerCode,
        p_admin_id: adminUser.id,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from find_customer");
      }

      // Flatten data for frontend while preserving nested structures
      const cust = (data as any).customer || data;
      const prof = (data as any).profile || {};
      const tierObj = (data as any).tier || {};

      const responseData = {
        ...(data as object),
        id: cust.id || (data as any).customer_id || (data as any).id,
        customer_id: cust.id || (data as any).customer_id,
        customer_code: cust.customer_code || (data as any).customer_code,
        full_name: prof.full_name || (data as any).full_name || cust.full_name,
        phone: prof.phone || (data as any).phone || cust.phone,
        city: cust.city || (data as any).city,
        status: cust.status || (data as any).status,
        tier: typeof (data as any).tier === "string" ? (data as any).tier : (tierObj.name || (data as any).tier_name || "Bronze"),
        tier_id: cust.tier_id || (data as any).tier_id || tierObj.id,
        point_value_tzs: tierObj.point_value_tzs ?? (data as any).point_value_tzs ?? 30,
        points_balance: cust.points_balance ?? (data as any).points_balance ?? 0,
        lifetime_purchases: cust.lifetime_purchases ?? (data as any).lifetime_purchases ?? 0,
        last_transaction_at: cust.last_transaction_at || (data as any).last_transaction_at,
        last_purchase_at: cust.last_transaction_at || (data as any).last_purchase_at,
        activity_deadline: cust.activity_deadline || (data as any).activity_deadline,
      };

      sendSuccess(res, responseData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/:customerCode/activity
   *
   * Get recent activity for a customer using the get_recent_activity RPC function.
   */
  async getRecentActivity(
    req: Request<{ customerCode: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { customerCode } = req.params;

      // First get customer_id from customer_code
      const { data: customerData } = await supabase
        .from("customers")
        .select("id")
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (!customerData) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      let { data, error } = await supabase.rpc("get_recent_activity", {
        p_customer_id: customerData.id,
        p_limit: 10,
      });

      if (error && /could not choose the best candidate|does not exist|PGRST202/i.test(error.message)) {
        ({ data, error } = await supabase.rpc("get_recent_activity", {
          p_customer_id: customerData.id,
        }));
      }

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      sendSuccess(res, normalizeRecentActivity(data, 10));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/customers/:identifier/statement
   *
   * Get customer statement for a date range using the get_customer_statement RPC function.
   * Supports JSON and CSV formats.
   */
  async getCustomerStatement(
    req: Request<{ identifier: string }, {}, {}, { from?: string; to?: string; format?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { identifier } = req.params;
      const { from, to, format = "json" } = req.query;

      // Sanitize from/to dates - ignore 'undefined', 'null', or empty strings
      const asBound = (value: unknown, endOfDay: boolean): string | null => {
        if (!value || value === "undefined" || value === "null" || typeof value !== "string") return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return endOfDay ? `${trimmed}T23:59:59.999Z` : `${trimmed}T00:00:00.000Z`;
        }
        return trimmed;
      };
      const safeFrom = asBound(from, false);
      const safeTo = asBound(to, true);

      const { data, error } = await supabase.rpc("get_customer_statement", {
        p_identifier: identifier,
        p_admin_id: adminUser.id,
        p_from: safeFrom,
        p_to: safeTo,
      });

      if (error) {
        throw new AppError(500, "RPC_ERROR", error.message);
      }

      if (!data || typeof data !== "object") {
        throw new AppError(500, "RPC_ERROR", "Unexpected response from get_customer_statement");
      }

      const result = data as { ok: boolean; code?: string };

      if (!result.ok) {
        if (result.code === "CUSTOMER_NOT_FOUND") {
          throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
        }
        throw new AppError(400, "STATEMENT_ERROR", "Failed to get customer statement");
      }

      if (format === "csv") {
        // Generate CSV with UTF-8 BOM
        const statement = data as any;
        const entries = statement.entries || [];
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const filename = `statement-${identifier}-${dateStr}.csv`;

        // CSV header
        const header = "date,type,reference,amount_tzs,points,value_tzs,status,note";

        // CSV rows
        const rows = entries.map((entry: any) => {
          return [
            entry.date || '',
            entry.type || '',
            entry.reference || '',
            entry.amount_tzs || '',
            entry.points || '',
            entry.value_tzs || '',
            entry.status || '',
            entry.note || ''
          ].join(',');
        });

        const csv = "\uFEFF" + [header, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else {
        sendSuccess(res, data);
      }
    } catch (error) {
      next(error);
    }
  }
}

export const adminCustomersController = new AdminCustomersController();
