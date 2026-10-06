import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";
import { supabase } from "./supabase";

export const ACCESS_TOKEN_KEY = "access_token";

let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000"
  ).replace(/\/+$/, "");
}

/**
 * Axios client instance configured with Supabase Bearer token and 401 handling.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Supabase access token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.set(
          "Authorization",
          `Bearer ${session.access_token}`
        );
      }
    } catch {
      // Continue without token if session retrieval fails
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 sign out and redirect to Login
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout error
      }

      if (onUnauthorizedCallback) {
        try {
          onUnauthorizedCallback();
        } catch {}
      }

      try {
        router.replace("/(auth)/login" as any);
      } catch {}
    }
    return Promise.reject(error);
  }
);

export function configureApiClient(): void {
  // Configured statically with axios instance
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      // Backend sendError format: { success: false, error: { message, code } }
      if ("error" in data && typeof (data as any).error === "object") {
        const errObj = (data as any).error;
        if (errObj?.message) return String(errObj.message);
      }
      if ("message" in data) {
        return String((data as any).message);
      }
    }

    const status = error.response?.status;
    if (status === 401) {
      return "Kipindi chako kimeisha. Tafadhali ingia tena. / Your session has expired. Please sign in again.";
    }
    if (status === 403) {
      return "Huna ruhusa ya kufanya kitendo hiki. / You do not have permission for this action.";
    }
    if (status === 404) {
      return "Rekodi au huduma haijapatikana. / Record not found.";
    }
    if (status === 409) {
      return "Hitilafu ya mgongano wa data. / Conflict error.";
    }
    if (status === 429) {
      return "Majaribio mengi mno. Tafadhali subiri kidogo kisha ujaribu tena. / Too many attempts. Please wait a moment.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/network error|failed to fetch|network request failed/i.test(message)) {
    return "Hakuna mtandao wa intaneti. Angalia muunganisho wako na ujaribu tena. / No internet connection. Check your connection and try again.";
  }

  return (
    message ||
    "Kuna hitilafu imetokea. Tafadhali jaribu tena. / Something went wrong. Please try again."
  );
}

export type UserProfile = {
  registered: boolean;
  role?: "customer" | "admin";
  profile?: {
    id: string;
    full_name: string;
    phone: string;
    role: "customer" | "admin";
    is_active: boolean;
    created_at: string;
  };
  customer?: {
    id: string;
    customer_code: string;
    initials: string;
    sequence_number: number;
    status: string;
    points_balance: number;
    last_transaction_at: string | null;
  } | null;
  user_id?: string;
  phone?: string | null;
};

/**
 * Calls GET /api/me to retrieve current user info and role.
 */
export async function fetchMe(token?: string): Promise<UserProfile> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.get<{ success: boolean; data: UserProfile }>(
    "/api/me",
    { headers }
  );
  return response.data?.data || (response.data as unknown as UserProfile);
}

/**
 * Calls POST /api/auth/complete-registration { full_name }
 */
export async function completeRegistration(
  fullName: string,
  token?: string
): Promise<{
  created: boolean;
  customer_id: string;
  customer_code: string;
}> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.post(
    "/api/auth/complete-registration",
    { full_name: fullName },
    { headers }
  );
  return response.data?.data || response.data;
}

/**
 * Calls POST /api/admin/customers/:customerCode/reset-pin { new_pin }
 */
export async function resetCustomerPin(
  customerCode: string,
  newPin: string
): Promise<{ success: boolean; message: string; customer_code: string }> {
  const response = await apiClient.post(
    `/api/admin/customers/${encodeURIComponent(customerCode)}/reset-pin`,
    { new_pin: newPin }
  );
  return response.data?.data || response.data;
}

export function formatOtpError(error: unknown): string {
  if (!error) {
    return "Kuna hitilafu imetokea. Tafadhali jaribu tena. / Something went wrong. Please try again.";
  }

  const message = (
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message)
        : String(error)
  ).toLowerCase();

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as any).status)
      : 0;

  // 1. No internet
  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("internet") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("offline") ||
    message.includes("abort")
  ) {
    return "Hakuna mtandao wa intaneti. Angalia muunganisho wako na ujaribu tena. / No internet connection. Check your connection and try again.";
  }

  // 2. Too many attempts (rate limited)
  if (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("security purposes") ||
    message.includes("exceeded") ||
    message.includes("wait")
  ) {
    return "Majaribio mengi mno. Tafadhali subiri kidogo kisha ujaribu tena. / Too many attempts. Please wait a moment before trying again.";
  }

  // 3. Expired code
  if (message.includes("expired") || message.includes("muda")) {
    return "Code imeisha muda wake. Tafadhali omba mpya. / The code has expired. Please request a new one.";
  }

  // 4. Code not delivered / number may not have WhatsApp
  if (
    message.includes("whatsapp") ||
    message.includes("deliver") ||
    message.includes("undeliver") ||
    message.includes("not registered") ||
    message.includes("channel") ||
    message.includes("failed to send")
  ) {
    return "Code haijafika. Hakikisha namba hii ina WhatsApp. / Code not delivered. Make sure this number has WhatsApp.";
  }

  // 5. Wrong code
  if (
    message.includes("invalid") ||
    message.includes("token") ||
    message.includes("wrong") ||
    message.includes("incorrect") ||
    message.includes("code")
  ) {
    return "Code si sahihi. Tafadhali angalia tena. / Invalid code. Please check and try again.";
  }

  return (
    (error instanceof Error ? error.message : typeof error === "string" ? error : "") ||
    "Kuna hitilafu imetokea. Tafadhali jaribu tena. / Something went wrong. Please try again."
  );
}

export function formatPoints(value: number): string {
  return new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(
    value
  );
}

export function formatTzs(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
