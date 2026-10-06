import { supabase } from "../../config/supabase.js";
import { AppError } from "../../utils/errors.js";

export interface CompleteRegistrationResult {
  ok: boolean;
  created: boolean;
  customer_id: string;
  customer_code: string;
}

export class AuthService {
  /**
   * Completes registration for an authenticated user.
   * Calls the atomic SQL function create_customer_profile.
   * The SQL function creates profile + customer + ID (e.g. IS01) in one transaction.
   * Idempotent: repeated calls return created: false with the same customer.
   */
  async completeRegistration(
    userId: string,
    fullName: string,
    phone: string
  ): Promise<CompleteRegistrationResult> {
    const { data, error } = await supabase.rpc("create_customer_profile", {
      p_user_id: userId,
      p_full_name: fullName.trim(),
      p_phone: phone,
    });

    if (error) {
      // Pass the PostgreSQL exception message so the error handler maps it
      throw new AppError(400, error.message, error.message);
    }

    if (!data || typeof data !== "object") {
      throw new AppError(500, "RPC_ERROR", "Unexpected response from registration service");
    }

    const result = data as CompleteRegistrationResult;
    return result;
  }
}

export const authService = new AuthService();
