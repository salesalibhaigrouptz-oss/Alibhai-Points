import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabase, publicSupabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { phoneToLoginEmail } from "../../utils/phone.js";
import { hashPin, verifyPin } from "../../utils/pin.js";
import { sendSuccess } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import type { ChangePinInput } from "./schema.js";

function isWeakPin(pin: string): boolean {
  const digits = [...pin].map(Number);
  const allSame = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1] + 1) % 10
  );
  const descending = digits.every(
    (digit, index) => index === 0 || digit === (digits[index - 1] + 9) % 10
  );
  return allSame || ascending || descending;
}

export class ChangePinController {
  async changePin(
    req: Request<{}, {}, ChangePinInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      const profile = req.profile;
      if (!user || !profile) {
        throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      }

      const { current_pin, new_pin } = req.body;
      if (current_pin === new_pin) {
        throw new AppError(400, "SAME_PIN", "New PIN must be different from current PIN.");
      }
      if (isWeakPin(new_pin)) {
        throw new AppError(400, "WEAK_PIN", "Choose a less predictable PIN.");
      }

      const email = user.email || phoneToLoginEmail(profile.phone);
      let authUser: any = null;

      // 1. Attempt verification via Supabase signInWithPassword if enabled
      try {
        const { data: authData, error: authError } =
          await publicSupabase.auth.signInWithPassword({
            email,
            password: current_pin,
          });

        if (!authError && authData?.user) {
          authUser = authData.user;
        } else if (
          authError &&
          (authError.code === "invalid_credentials" ||
            authError.message.toLowerCase().includes("invalid login credentials"))
        ) {
          throw new AppError(400, "INVALID_CURRENT_PIN", "Current PIN is incorrect.");
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }

      // 2. Fallback to admin lookup & pin_hash verification if Supabase signInWithPassword is unavailable or email logins are disabled
      if (!authUser) {
        const { data: adminUserData, error: adminUserError } =
          await supabase.auth.admin.getUserById(user.id);

        if (adminUserError || !adminUserData?.user) {
          throw new AppError(502, "AUTH_VERIFICATION_FAILED", "Unable to verify current PIN.");
        }

        const storedHash = adminUserData.user.user_metadata?.pin_hash;
        if (!storedHash) {
          if (current_pin !== "123456") {
            throw new AppError(400, "INVALID_CURRENT_PIN", "Current PIN is incorrect.");
          }
        } else if (!verifyPin(current_pin, storedHash)) {
          throw new AppError(400, "INVALID_CURRENT_PIN", "Current PIN is incorrect.");
        }

        authUser = adminUserData.user;
      }

      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          password: new_pin,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            pin_hash: hashPin(new_pin),
          },
        }
      );

      if (passwordError) {
        throw new AppError(500, "AUTH_UPDATE_FAILED", "Failed to update PIN.");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_pin: false })
        .eq("id", user.id);

      if (profileError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to update PIN change status.");
      }

      const { error: auditError } = await supabase.from("audit_logs").insert({
        action: "PIN_CHANGED",
        actor_id: user.id,
        target_id: user.id,
        target_type: "profile",
        metadata: {},
      });

      if (auditError) {
        logger.error({ actorId: user.id }, "PIN change audit log insert failed");
        throw new AppError(500, "AUDIT_LOG_FAILED", "Failed to record PIN change.");
      }

      const token = jwt.sign(
        {
          id: profile.id,
          role: profile.role,
          phone: profile.phone,
          email: user.email || phoneToLoginEmail(profile.phone),
        },
        env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      sendSuccess(res, { message: "PIN changed successfully.", token });
    } catch (error) {
      next(error);
    }
  }
}

export const changePinController = new ChangePinController();
