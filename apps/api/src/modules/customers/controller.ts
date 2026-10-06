import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";

export class CustomerController {
  /**
   * GET /api/customer/me
   * Returns details for the authenticated customer.
   */
  async getCustomerMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = req.profile;
      const customer = req.customer;

      if (!profile || !customer) {
        throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer record not found");
      }

      sendSuccess(res, {
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          is_active: profile.is_active,
          created_at: profile.created_at,
        },
        customer: {
          id: customer.id,
          customer_code: customer.customer_code,
          initials: customer.initials,
          sequence_number: customer.sequence_number,
          status: customer.status,
          points_balance: customer.points_balance,
          last_transaction_at: customer.last_transaction_at,
          created_at: customer.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
