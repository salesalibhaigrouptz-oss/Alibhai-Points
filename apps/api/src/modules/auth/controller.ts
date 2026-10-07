import type { Request, Response, NextFunction } from "express";
import { authService } from "./service.js";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import type { LoginInput, SignupInput, CompleteRegistrationInput } from "./schema.js";

export class AuthController {
  /**
   * POST /api/auth/login
   * Pure Phone + 6-digit PIN login. Returns JWT token and user info.
   */
  async login(
    req: Request<{}, {}, LoginInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { phone, pin } = req.body;
      const result = await authService.login(phone, pin);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/signup
   * Customer signs up with Full Name + Phone + 6-digit PIN in one step.
   * Returns JWT token and created customer record.
   */
  async signup(
    req: Request<{}, {}, SignupInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { phone, pin } = req.body;
      const fullName = req.body.fullName || req.body.full_name || "";
      const result = await authService.signup(fullName, phone, pin);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/me
   * Returns current user identity, role, profile, and customer record.
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
   * POST /api/auth/complete-registration (backward-compatibility)
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

      const { full_name } = req.body;
      const phone = user.phone || "";
      const result = await authService.completeRegistration(
        user.id,
        full_name,
        phone
      );

      const statusCode = result.created ? 201 : 200;
      sendSuccess(res, result, statusCode);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
