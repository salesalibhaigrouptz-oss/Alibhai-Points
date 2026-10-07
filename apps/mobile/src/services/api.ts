import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";
import { supabase } from "./supabase";

import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACCESS_TOKEN_KEY = "access_token";

let onUnauthorizedCallback: (() => void) | null = null;
let inMemoryToken: string | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

export async function setStoredToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {}
}

export async function getStoredToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  try {
    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    inMemoryToken = token;
    return token;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000"
  ).replace(/\/+$/, "");
}

/**
 * Axios client instance configured with Bearer token and 401 handling.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach access token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await getStoredToken();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      // Continue without token if retrieval fails
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 sign out
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await setStoredToken(null);
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

/**
 * Pure Phone + PIN login API call.
 */
export async function apiLogin(phone: string, pin: string): Promise<any> {
  const res = await apiClient.post("/api/auth/login", { phone, pin });
  const data = res.data?.data;
  if (data?.token) {
    await setStoredToken(data.token);
  }
  return data;
}

/**
 * Pure Phone + Name + PIN sign up API call.
 */
export async function apiSignup(
  fullName: string,
  phone: string,
  pin: string
): Promise<any> {
  const res = await apiClient.post("/api/auth/signup", {
    fullName,
    phone,
    pin,
  });
  const data = res.data?.data;
  if (data?.token) {
    await setStoredToken(data.token);
  }
  return data;
}

export function configureApiClient(): void {
  // Configured statically with axios instance
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const errorCode = data?.error?.code;
    
    // Handle specific backend error codes with bilingual messages
    if (errorCode) {
      switch (errorCode) {
        case 'UNAUTHORIZED':
          return "Hujathibitishwa. Tafadhali ingia. / Unauthorized. Please sign in.";
        case 'INVALID_TOKEN':
          return "Token batili au imesha. Tafadhali ingia tena. / Invalid or expired token. Please sign in again.";
        case 'ACCOUNT_DISABLED':
          return "Akaunti yako imezimwa. Wasiliana na ofisi. / Your account has been disabled. Contact the office.";
        case 'NOT_ADMIN':
          return "Huna ruhusa ya admin. / You do not have admin access.";
        case 'FORBIDDEN':
          return "Huna ruhusa ya kufanya kitendo hiki. / You do not have permission for this action.";
        case 'NOT_FOUND':
          return "Rekodi haijapatikana. / Record not found.";
        case 'VALIDATION_ERROR':
          return "Tafadhali angalia data yako na ujaribu tena. / Please check your data and try again.";
        case 'INVALID_NAME':
          return "Jina batili. Tumia herufi, nafasi na alama pekee. / Invalid name. Use letters, spaces and punctuation only.";
        case 'CUSTOMER_NOT_FOUND':
          return "Mteja hayapatikani. / Customer not found.";
        case 'INSUFFICIENT_REDEEMABLE_POINTS':
          return "Huna pointi za kutosha za kutumia. / You don't have enough redeemable points.";
        case 'POINTS_ALREADY_USED':
          return "Pointi hizi zimeshatumika. Haupwezi kufuta ununuzi huu. / These points have already been used. Cannot void this purchase.";
        case 'RATE_LIMIT_EXCEEDED':
          return "Majaribio mengi mno. Tafadhali subiri kidogo kisha ujaribu tena. / Too many attempts. Please wait a moment.";
        case 'TOO_MANY_ATTEMPTS':
          return "Majaribio mengi mno ya kuingia. Tafadhali subiri dakika chache. / Too many login attempts. Please wait a few minutes.";
        case 'INTERNAL_SERVER_ERROR':
          return "Kuna hitilafu ya seva. Tafadhali jaribu tena baadaye. / Server error. Please try again later.";
      }
    }
    
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

// Admin API endpoints

export async function getDashboardMetrics(): Promise<{
  customers: {
    total: number;
    active: number;
    inactive: number;
    near_deadline: number;
  };
  points: {
    total_issued: number;
    redeemable: number;
    waiting: number;
    redeemed: number;
    expired: number;
  };
  purchases: {
    total_value: number;
    today: {
      count: number;
      value: number;
    };
    this_month: {
      count: number;
      value: number;
    };
  };
  redemptions: {
    pending_count: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/dashboard");
  return response.data.data;
}

export async function getCustomers(params?: {
  search?: string;
  status?: string;
  near_deadline?: string;
  page?: number;
  limit?: number;
}): Promise<{
  customers: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/customers", { params });
  return response.data.data;
}

export async function getCustomer(customerCode: string): Promise<any> {
  const response = await apiClient.get<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(customerCode)}`
  );
  return response.data.data;
}

export async function getCustomerPurchases(
  customerCode: string,
  params?: { page?: number; limit?: number }
): Promise<{
  purchases: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(customerCode)}/purchases`,
    { params }
  );
  return response.data.data;
}

export async function getPurchases(params?: {
  customer?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): Promise<{
  purchases: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/purchases", { params });
  return response.data.data;
}

export async function getRedemptions(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  redemptions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/redemptions", { params });
  return response.data.data;
}

export async function getRedemption(id: string): Promise<any> {
  const response = await apiClient.get<{ success: boolean; data: any }>(`/api/admin/redemptions/${id}`);
  return response.data.data;
}

export async function completeRedemption(id: string): Promise<any> {
  const response = await apiClient.post<{ success: boolean; data: any }>(`/api/admin/redemptions/${id}/complete`);
  return response.data.data;
}

export async function cancelRedemption(id: string, reason?: string): Promise<any> {
  const response = await apiClient.post<{ success: boolean; data: any }>(
    `/api/admin/redemptions/${id}/cancel`,
    { reason }
  );
  return response.data.data;
}

export async function directRedeem(customerCode: string, points: number): Promise<any> {
  const response = await apiClient.post<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(customerCode)}/redeem`,
    { points }
  );
  return response.data.data;
}

export async function previewPurchase(customerCode: string, purchaseAmount: number): Promise<{
  customer_name: string;
  customer_status: string;
  points_earned: number;
  amount_per_point: number;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>("/api/admin/purchases/preview", {
    customer_code: customerCode,
    purchase_amount: purchaseAmount,
  });
  return response.data.data;
}

export async function recordPurchase(
  customerCode: string,
  purchaseAmount: number,
  idempotencyKey?: string
): Promise<{
  reference: string;
  points_earned: number;
  new_balance: number;
  customer_status: string;
  duplicate: boolean;
  purchase_id: string;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>("/api/admin/purchases", {
    customer_code: customerCode,
    purchase_amount: purchaseAmount,
    idempotency_key: idempotencyKey || `purchase-${Date.now()}`,
  });
  return response.data.data;
}

export async function getPointRules(): Promise<{
  tzsPerPoint: number;
  redemptionWaitDays: number;
  activityPeriodDays: number;
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/rules");
  const rule = response.data.data;
  return {
    tzsPerPoint: rule.amount_per_point,
    redemptionWaitDays: rule.redemption_wait_days,
    activityPeriodDays: rule.inactivity_days,
  };
}

export async function updatePointRules(rules: {
  tzsPerPoint: number;
  redemptionWaitDays: number;
  activityPeriodDays: number;
}): Promise<any> {
  const response = await apiClient.put<{ success: boolean; data: any }>("/api/admin/rules", {
    amount_per_point: rules.tzsPerPoint,
    redemption_wait_days: rules.redemptionWaitDays,
    inactivity_days: rules.activityPeriodDays,
  });
  return response.data.data;
}

export async function getAuditLogs(params?: {
  admin?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{
  logs: any[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/audit-logs", { params });
  return response.data.data;
}

// Additional admin functions
export async function updateCustomerStatus(
  customerCode: string,
  isActive: boolean
): Promise<{ success: boolean; message: string; customer_code: string; is_active: boolean }> {
  const response = await apiClient.patch<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(customerCode)}`,
    { is_active: isActive }
  );
  return response.data.data;
}

export async function voidPurchase(
  purchaseId: string,
  reason: string
): Promise<{ success: boolean; message: string; status: string }> {
  const response = await apiClient.post<{ success: boolean; data: any }>(
    `/api/admin/purchases/${purchaseId}/void`,
    { reason }
  );
  return response.data.data;
}

export async function getReportsSummary(params?: {
  from?: string;
  to?: string;
}): Promise<any> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/reports/summary", { params });
  return response.data.data;
}

// Customer endpoints
export async function getCustomerPointsSummary(): Promise<{
  customer_code: string;
  status: string;
  total_points: number;
  redeemable_points: number;
  waiting_points: number;
  requested_points: number;
  redeemed_points: number;
  expired_points: number;
  next_unlock_at: string | null;
  activity_deadline: string | null;
  days_left: number | null;
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/customer/points/summary");
  return response.data.data;
}

export async function createCustomerRedemption(points: number): Promise<{
  redemption_id: string;
  reference: string;
  status: string;
  points: number;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>("/api/customer/redemptions", { points });
  return response.data.data;
}

export async function getMyPurchases(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  purchases: any[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/customer/purchases", { params });
  return response.data.data;
}

export async function getCustomerRedemptions(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  redemptions: any[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/customer/redemptions", { params });
  return response.data.data;
}
