import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toE164 } from "../utils/phone";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    supabaseAnonKey !== "placeholder-anon-key"
);

/**
 * Supabase client configured with the public anonymous key.
 * Never use the service-role key in client applications.
 */
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
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
 * Sends a WhatsApp OTP using Supabase Auth (or mock data flow if credentials are not configured).
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

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: toE164(e164Phone) as string,
      options: { channel: "whatsapp" },
    });

    if (error) {
      throw error;
    }

    return {
      challengeId: data?.messageId || `wa-${Date.now()}`,
      phoneNumber: e164Phone,
      maskedPhoneNumber: maskPhoneNumber(e164Phone),
    };
  }

  // Mock flow for testing when using mock data
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    challengeId: `mock-wa-${Date.now()}`,
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

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: toE164(e164Phone) as string,
      token,
      type: "sms",
    });

    if (error) {
      throw error;
    }

    const session = data?.session;
    const user = data?.user ?? session?.user;
    const registered = Boolean(user?.user_metadata?.registered ?? false);

    if (session?.access_token) {
      if (!registered) {
        return {
          status: "registration_required",
          registrationToken: session.access_token,
          registered: false,
          user,
        };
      }
      return {
        status: "authenticated",
        accessToken: session.access_token,
        registered: true,
        user,
      };
    }

    return {
      status: "registration_required",
      registrationToken: `reg-${Date.now()}`,
      registered: false,
      user,
    };
  }

  // Mock flow for testing when using mock data
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    status: "registration_required",
    registrationToken: `mock-reg-token-${Date.now()}`,
    accessToken: `mock-access-token-${Date.now()}`,
    registered: false,
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
