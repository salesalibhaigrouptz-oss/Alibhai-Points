import { apiLogin, apiSignup, setStoredToken } from "./api";
import { sendWhatsAppOtp, verifyWhatsAppOtp } from "./supabase";

export type AuthMode = "pin" | "whatsapp_otp";

export const AUTH_MODE: AuthMode =
  (process.env.EXPO_PUBLIC_AUTH_MODE as AuthMode) || "pin";

export interface AuthService {
  mode: AuthMode;
  signUp(params: { fullName?: string; phone: string; pin: string }): Promise<any>;
  signInWithPassword(params: { phone: string; pin: string }): Promise<any>;
  signOut(): Promise<void>;
  sendOtp?(phone: string): Promise<any>;
  verifyOtp?(phone: string, token: string): Promise<any>;
}

/**
 * Pure Phone + 6-digit PIN Auth implementation.
 * Communicates directly with backend API.
 * NO EMAIL USED ANYWHERE.
 */
export const pinAuthService: AuthService = {
  mode: "pin",
  async signUp({ fullName, phone, pin }) {
    return apiSignup(fullName || "", phone, pin);
  },
  async signInWithPassword({ phone, pin }) {
    return apiLogin(phone, pin);
  },
  async signOut() {
    await setStoredToken(null);
  },
};

/**
 * WhatsApp OTP Auth implementation.
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
    await setStoredToken(null);
  },
};

export const authService: AuthService =
  AUTH_MODE === "whatsapp_otp" ? otpAuthService : pinAuthService;
