import jwt from "jsonwebtoken";
import { supabase } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { toE164 } from "../../utils/phone.js";
import { hashPin, verifyPin } from "../../utils/pin.js";
import type { Customer, Profile } from "../../types/index.js";

export interface CompleteRegistrationResult {
  ok: boolean;
  created: boolean;
  customer_id: string;
  customer_code: string;
}

export interface AuthSessionResponse {
  token: string;
  role: "customer" | "admin";
  profile: Profile;
  customer: Customer | null;
}

export class AuthService {
  /**
   * Pure Phone + 6-digit PIN Login.
   * NO EMAIL USED.
   */
  async login(phone: string, pin: string): Promise<AuthSessionResponse> {
    const normalizedPhone = toE164(phone);

    // 1. Look up profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (profileError || !profile) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Namba au PIN si sahihi");
    }

    if (!profile.is_active) {
      throw new AppError(
        403,
        "ACCOUNT_DISABLED",
        "Akaunti hii imesitishwa. Tafadhali wasiliana na ofisi / Account deactivated"
      );
    }

    // 2. Fetch auth user to verify PIN
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(
      profile.id
    );

    if (authError || !authData?.user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Namba au PIN si sahihi");
    }

    let storedHash = authData.user.user_metadata?.pin_hash;

    // Bootstrap: If no PIN hash stored yet (e.g. seeded admin), and PIN matches default '123456'
    if (!storedHash && pin === "123456") {
      storedHash = hashPin("123456");
      await supabase.auth.admin.updateUserById(profile.id, {
        user_metadata: { ...authData.user.user_metadata, pin_hash: storedHash },
      });
    }

    const isValid = verifyPin(pin, storedHash);
    if (!isValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Namba au PIN si sahihi");
    }

    // 3. Load customer record if user is a customer
    let customer: Customer | null = null;
    if (profile.role === "customer") {
      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();
      customer = (customerData as Customer) || null;
    }

    // 4. Generate JWT
    const token = jwt.sign(
      {
        id: profile.id,
        role: profile.role,
        phone: profile.phone,
      },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      token,
      role: profile.role as "customer" | "admin",
      profile: profile as Profile,
      customer,
    };
  }

  /**
   * Pure Phone + Name + 6-digit PIN Sign Up.
   * NO EMAIL USED.
   */
  async signup(
    fullName: string,
    phone: string,
    pin: string
  ): Promise<AuthSessionResponse> {
    const normalizedPhone = toE164(phone);
    const cleanName = fullName.trim();

    if (cleanName.length < 2) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Weka jina kamili (angalau herufi 2) / Enter full name"
      );
    }

    // 1. Check if phone already registered in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (existingProfile) {
      throw new AppError(
        409,
        "USER_EXISTS",
        "Namba hii ya simu tayari imesajiliwa / This phone number is already registered"
      );
    }

    const pinHash = hashPin(pin);

    // 2. Create user in auth.users with phone only (NO email)
    let userId: string;
    const { data: createData, error: createError } =
      await supabase.auth.admin.createUser({
        phone: normalizedPhone,
        phone_confirm: true,
        user_metadata: { pin_hash: pinHash, role: "customer" },
      });

    if (createData?.user) {
      userId = createData.user.id;
    } else {
      // If phone existed in auth.users from an old attempt, update its metadata
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existingUser = usersData?.users.find(
        (u) =>
          u.phone === normalizedPhone ||
          u.phone === normalizedPhone.replace("+", "")
      );

      if (existingUser) {
        await supabase.auth.admin.updateUserById(existingUser.id, {
          user_metadata: { pin_hash: pinHash, role: "customer" },
        });
        userId = existingUser.id;
      } else {
        throw new AppError(
          500,
          "SIGNUP_FAILED",
          createError?.message || "Failed to create user"
        );
      }
    }

    // 3. Atomically create profile + customer via existing stored function
    const regResult = await this.completeRegistration(
      userId,
      cleanName,
      normalizedPhone
    );

    // 4. Load created profile and customer record
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("profile_id", userId)
      .maybeSingle();

    // 5. Generate JWT
    const token = jwt.sign(
      {
        id: userId,
        role: "customer",
        phone: normalizedPhone,
      },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      token,
      role: "customer",
      profile: profile as Profile,
      customer: (customer as Customer) || null,
    };
  }

  /**
   * Completes registration for an authenticated user.
   * Calls the atomic SQL function create_customer_profile.
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
      throw new AppError(400, error.message, error.message);
    }

    if (!data || typeof data !== "object") {
      throw new AppError(
        500,
        "RPC_ERROR",
        "Unexpected response from registration service"
      );
    }

    return data as CompleteRegistrationResult;
  }
}

export const authService = new AuthService();
