import { supabase } from "./supabase";
import { phoneToEmail, toE164 } from "../utils/phone";
import { sendWhatsAppOtp, verifyWhatsAppOtp } from "./supabase";

export type AuthMode = "pin" | "whatsapp_otp";

/**
 * Global setting controlling authentication flow.
 * Default is 'pin', can be toggled via EXPO_PUBLIC_AUTH_MODE environment variable.
 */
export const AUTH_MODE: AuthMode =
  (process.env.EXPO_PUBLIC_AUTH_MODE as AuthMode) || "pin";

export interface AuthService {
  mode: AuthMode;
  signUp(params: { phone: string; pin: string }): Promise<any>;
  signInWithPassword(params: { phone: string; pin: string }): Promise<any>;
  signOut(): Promise<void>;
  // Existing WhatsApp OTP methods
  sendOtp?(phone: string): Promise<any>;
  verifyOtp?(phone: string, token: string): Promise<any>;
}

/**
 * Temporary Phone + PIN Auth implementation.
 * Maps phone to fake Supabase Auth email (255XXXXXXXXX@<AUTH_EMAIL_DOMAIN>)
 * and uses 6-digit PIN as the Supabase password.
 */
export const pinAuthService: AuthService = {
  mode: "pin",
  async signUp({ phone, pin }) {
    const email = phoneToEmail(phone);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pin,
    });
    if (error) throw error;
    return data;
  },
  async signInWithPassword({ phone, pin }) {
    const email = phoneToEmail(phone);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

/**
 * WhatsApp OTP Auth implementation (preserves original flow unchanged).
 */
export const otpAuthService: AuthService = {
  mode: "whatsapp_otp",
  async signUp() {
    throw new Error("Direct sign up is not supported in WhatsApp OTP mode");
  },
  async signInWithPassword() {
    throw new Error("Password login is not supported in WhatsApp OTP mode");
  },
  async sendOtp(phone: string) {
    return sendWhatsAppOtp(phone);
  },
  async verifyOtp(phone: string, token: string) {
    return verifyWhatsAppOtp(phone, token);
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

/**
 * The active authService instance based on AUTH_MODE.
 */
export const authService: AuthService =
  AUTH_MODE === "whatsapp_otp" ? otpAuthService : pinAuthService;
