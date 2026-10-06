import type { Request, Response, NextFunction } from "express";
import { authService } from "./service.js";
import { getVerifiedPhone } from "../../utils/phone.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { CompleteRegistrationInput } from "./schema.js";

export class AuthController {
  /**
   * GET /api/me
   * Returns current user identity, role, profile, and customer record.
   * If OTP was verified but profile not yet completed, returns registered: false.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const profile = req.profile;
      const customer = req.customer;

      if (!profile) {
        sendSuccess(res, {
          registered: false,
          user_id: user.id,
          phone: user.phone || null,
        });
        return;
      }

      sendSuccess(res, {
        registered: true,
        role: profile.role,
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          is_active: profile.is_active,
          created_at: profile.created_at,
        },
        customer: customer
          ? {
              id: customer.id,
              customer_code: customer.customer_code,
              initials: customer.initials,
              sequence_number: customer.sequence_number,
              status: customer.status,
              points_balance: customer.points_balance,
              last_transaction_at: customer.last_transaction_at,
            }
          : null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/complete-registration
   * Completes registration using full_name from body and phone from verified user.
   * Returns 201 for initial creation, 200 for idempotent repeat requests.
   */
  async completeRegistration(
    req: Request<{}, {}, CompleteRegistrationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      // Phone ALWAYS comes from the verified Supabase Auth user's fake email,
      // never from the request body. getVerifiedPhone() is the single place to
      // swap back to real OTP (user.phone) when the SMS flow is reinstated.
      const normalizedPhone = getVerifiedPhone(user);
      const { full_name } = req.body;

      const result = await authService.completeRegistration(
        user.id,
        full_name,
        normalizedPhone
      );

      // 201 Created on first call, 200 OK on idempotent retry
      const statusCode = result.created ? 201 : 200;

      sendSuccess(
        res,
        {
          created: result.created,
          customer_id: result.customer_id,
          customer_code: result.customer_code,
        },
        statusCode
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
