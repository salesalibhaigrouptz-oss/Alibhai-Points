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
    let userObj: { id: string; phone?: string } | null = null;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (decoded?.id) {
        userObj = { id: decoded.id, phone: decoded.phone };
      }
    } catch {
      // Fallback: check with Supabase Auth
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (!authError && authData?.user) {
          userObj = authData.user;
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
      .select("*")
      .eq("id", req.user.id)
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

      req.profile = profileData as Profile;

      // If customer profile exists, load customer record
      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("profile_id", req.user.id)
        .maybeSingle();

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
