import type { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { AppError } from "../utils/errors.js";
import type { Customer, Profile } from "../types/index.js";

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Authentication middleware:
 * 1. Reads the Bearer token from the Authorization header.
 * 2. Verifies the token using local JWT or Supabase Auth.
 * 3. Rejects missing, invalid, or expired tokens (401).
 * 4. Loads the user profile from public.profiles table.
 * 5. Rejects users with is_active = false (403 ACCOUNT_DISABLED).
 * 6. The role ALWAYS comes from public.profiles.role, never from JWT claims or user_metadata.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization token");
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Token cannot be empty");
    }

    // Verify token with backend JWT or Supabase Auth
    let userObj: { id: string; phone?: string; email?: string } | null = null;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (decoded?.id) {
        userObj = { id: decoded.id, phone: decoded.phone, email: decoded.email };
      }
    } catch {
      // Fallback: check with Supabase Auth
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (!authError && authData?.user) {
          userObj = { id: authData.user.id, phone: authData.user.phone, email: authData.user.email };
        }
      } catch {}
    }

    if (!userObj) {
      throw new AppError(401, "INVALID_TOKEN", "Session token is invalid or expired");
    }

    req.user = userObj as any;

    // Load profile from the database
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*, customers(*)")
      .eq("id", (req.user as any).id)
      .maybeSingle();

    if (profileError) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to load user profile");
    }

    if (profileData) {
      // Check if profile is active
      if (!profileData.is_active) {
        throw new AppError(
          403,
          "ACCOUNT_DISABLED",
          "Your account has been deactivated. Please contact support."
        );
      }

      // Extract customer data from the nested select
      const customerData = (profileData as any).customers || null;
      delete (profileData as any).customers;

      req.profile = profileData as Profile;
      req.customer = (customerData as Customer) || null;
    } else {
      // User has verified OTP in Supabase Auth but hasn't completed registration yet
      req.profile = null;
      req.customer = null;
    }

    next();
  } catch (error) {
    next(error);
  }
}
