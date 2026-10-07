import type { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { parsePaginationParams, buildPaginationResult } from "../../utils/pagination.js";

export class AdminAuditController {
  /**
   * GET /api/admin/audit-logs
   *
   * Returns audit logs with filters and pagination.
   * Filters: admin (by admin_id), action, date range (from, to)
   */
  async getAuditLogs(
    req: Request<
      {},
      {},
      {},
      {
        admin?: string;
        action?: string;
        from?: string;
        to?: string;
        page?: string;
        page_size?: string;
        limit?: string;
      }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { admin, action, from, to, page, page_size, limit } = req.query;

      const { page: pageNum, page_size: pageSize, offset } = parsePaginationParams({
        page,
        page_size,
        limit,
      });

      let query = supabase
        .from("admin_audit_logs")
        .select(`
          id,
          admin_id,
          action,
          entity_type,
          entity_id,
          description,
          metadata,
          created_at,
          profiles!inner (
            full_name,
            phone
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply filters
      if (admin) {
        query = query.eq("admin_id", admin);
      }

      if (action) {
        query = query.eq("action", action);
      }

      if (from) {
        query = query.gte("created_at", from);
      }

      if (to) {
        query = query.lte("created_at", to);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new AppError(500, "DATABASE_ERROR", error.message);
      }

      const pagination = buildPaginationResult(pageNum, pageSize, count || 0);

      sendSuccess(res, {
        logs: data,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminAuditController = new AdminAuditController();
