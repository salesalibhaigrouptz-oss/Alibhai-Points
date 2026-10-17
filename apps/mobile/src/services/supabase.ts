import { createClient } from "@supabase/supabase-js";
import { toE164 } from "../utils/phone";
import { mobileEnv } from "../config/env";
import { appStorage } from "./storage";

const secureStorageAdapter = {
  getItem: (key: string) => appStorage.getItem(key),
  setItem: (key: string, value: string) => appStorage.setItem(key, value),
  removeItem: (key: string) => appStorage.removeItem(key),
};

/**
 * Supabase client configured with the public anonymous key.
 * Never use the service-role key in client applications.
 * Sessions use SecureStore on native and browser localStorage on web.
 */
export const supabase = createClient(
  mobileEnv.EXPO_PUBLIC_SUPABASE_URL,
  mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: secureStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

export type OtpVerificationResult = {
  status: "authenticated" | "registration_required";
  accessToken?: string;
  registrationToken?: string;
  registered?: boolean;
  user?: any;
};

/**
 * Sends a WhatsApp OTP using Supabase Auth.
 */
export async function sendWhatsAppOtp(phone: string): Promise<{
  challengeId: string;
  phoneNumber: string;
  maskedPhoneNumber?: string;
}> {
  const e164Phone = toE164(phone);
  if (!e164Phone) {
    throw new Error(
      "Weka namba sahihi ya WhatsApp (mfano: 07XXXXXXXX au +255XXXXXXXXX) / Enter a valid WhatsApp number."
    );
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: toE164(e164Phone) as string,
    options: { channel: "whatsapp" },
  });

  if (error) {
    throw error;
  }

  return {
    challengeId: data?.messageId || "",
    phoneNumber: e164Phone,
    maskedPhoneNumber: maskPhoneNumber(e164Phone),
  };
}

/**
 * Verifies a WhatsApp OTP token using Supabase Auth.
 * verifyOtp uses type: 'sms' per Supabase API specification.
 */
export async function verifyWhatsAppOtp(
  phone: string,
  token: string
): Promise<OtpVerificationResult> {
  const e164Phone = toE164(phone) || phone;

  const { data, error } = await supabase.auth.verifyOtp({
    phone: toE164(e164Phone) as string,
    token,
    type: "sms",
  });

  if (error) {
    throw error;
  }

  const session = data.session;
  const user = data.user ?? session?.user;
  if (!session?.access_token) {
    throw new Error("Authentication did not return a valid session");
  }

  const registered = Boolean(user?.user_metadata?.registered ?? false);
  return registered
    ? {
        status: "authenticated",
        accessToken: session.access_token,
        registered: true,
        user,
      }
    : {
        status: "registration_required",
        registrationToken: session.access_token,
        registered: false,
        user,
      };
}

export function maskPhoneNumber(phone: string): string {
  const clean = toE164(phone) || phone;
  if (clean.length >= 12) {
    // e.g. +255754123456 -> +255 7XX XXX 456
    const country = clean.slice(0, 4); // +255
    const prefix = clean.slice(4, 5); // 7
    const suffix = clean.slice(-3); // 456
    return `${country} ${prefix}XX XXX ${suffix}`;
  }
  return clean;
}
