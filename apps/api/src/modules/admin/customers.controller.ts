import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { UpdateCustomerStatusInput } from "./schema.js";

export class AdminCustomersController {
  /**
   * GET /api/admin/customers
   *
   * List customers with optional search, status filter, and near_deadline filter.
   * Search: customer_code, phone, or full_name
   * near_deadline=true: active customers whose deadline is within 5 days
   * Pagination: page, limit
   */
  async listCustomers(
    req: Request<{}, {}, {}, { search?: string; status?: string; near_deadline?: string; page?: string; limit?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { search, status, near_deadline, page = "1", limit = "20" } = req.query;

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
          created_at,
          updated_at,
          profiles!inner (
            id,
            full_name,
            phone,
            is_active
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
          .eq("is_active")
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

      sendSuccess(res, {
        customers: filteredData,
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
          created_at,
          updated_at,
          profiles!inner (
            id,
            full_name,
            phone,
            is_active,
            created_at
          )
        `)
        .eq("customer_code", customerCode.toUpperCase())
        .single();

      if (error || !data) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      }

      sendSuccess(res, data);
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
          created_at,
          customers!inner (
            customer_code
          )
        `, { count: "exact" })
        .eq("customers.customer_code", customerCode.toUpperCase())
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
}

export const adminCustomersController = new AdminCustomersController();
