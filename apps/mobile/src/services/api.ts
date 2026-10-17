import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";
import { supabase } from "./supabase";
import { mobileEnv } from "../config/env";
import { appStorage } from "./storage";

export const ACCESS_TOKEN_KEY = "access_token";
type RetryableRequest = InternalAxiosRequestConfig & {
  __retriedGet?: boolean;
};

let onUnauthorizedCallback: (() => void) | null = null;
let inMemoryToken: string | null = null;

export function setOnUnauthorizedCallback(cb: (() => void) | null): void {
  onUnauthorizedCallback = cb;
}

export async function setStoredToken(token: string | null): Promise<void> {
  inMemoryToken = token;
  if (token) {
    await appStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await appStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export async function getStoredToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const token = await appStorage.getItem(ACCESS_TOKEN_KEY);
  inMemoryToken = token;
  return token;
}

export function getApiBaseUrl(): string {
  return mobileEnv.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
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
    const status = error?.response?.status as number | undefined;

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

    const config = error?.config as RetryableRequest | undefined;
    if (
      status !== 401 &&
      config?.method?.toLowerCase() === "get" &&
      !config.__retriedGet &&
      (status === undefined || status >= 500)
    ) {
      config.__retriedGet = true;
      return apiClient.request(config);
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
 * Pure Phone + Name + City + PIN sign up API call.
 */
export async function apiSignup(
  fullName: string,
  city: string,
  phone: string,
  pin: string
): Promise<any> {
  const res = await apiClient.post("/api/auth/signup", {
    fullName,
    city,
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
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "Muda umeisha. Jaribu tena. / The request timed out. Please try again.";
    }

    const status = error.response?.status;
    if (status !== undefined && status >= 500) {
      return "Huduma haipatikani kwa sasa. Jaribu tena baadaye. / The service is unavailable right now. Please try again later.";
    }
    if (!error.response) {
      return "Hakuna muunganisho wa intaneti. Angalia mtandao wako ujaribu tena. / No internet connection. Check your network and try again.";
    }

    const data = error.response?.data;
    const errorCode = data?.error?.code;

    // Return error code for translation in UI components
    if (errorCode) {
      return errorCode;
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

    if (status === 401) {
      return "INVALID_TOKEN";
    }
    if (status === 403) {
      return "FORBIDDEN";
    }
    if (status === 404) {
      return "NOT_FOUND";
    }
    if (status === 409) {
      return "CONFLICT";
    }
    if (status === 429) {
      return "RATE_LIMIT_EXCEEDED";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/network error|failed to fetch|network request failed/i.test(message)) {
    return "Hakuna muunganisho wa intaneti. Angalia mtandao wako ujaribu tena. / No internet connection. Check your network and try again.";
  }
  if (/timeout|timed out/i.test(message)) {
    return "Muda umeisha. Jaribu tena. / The request timed out. Please try again.";
  }

  return message || "GENERIC_ERROR";
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
    city?: string | null;
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
 * Calls POST /api/auth/complete-registration { full_name, city }
 */
export async function completeRegistration(
  fullName: string,
  city: string,
  token?: string
): Promise<{
  created: boolean;
  customer_id: string;
  customer_code: string;
}> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.post(
    "/api/auth/complete-registration",
    { full_name: fullName, city },
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
  const formatted = new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value);
  // Replace TZS with TSh for Tanzanian Shilling
  return formatted.replace('TZS', 'TSh');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDaysLeft(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  return `${days} days left`;
}

// Admin API endpoints

export async function getDashboardMetrics(city?: string): Promise<{
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
  city_breakdown?: Array<{
    city: string;
    count: number;
  }>;
  tier_counts?: Array<{
    tier: string;
    count: number;
  }>;
  by_city?: Array<{
    city: string;
    customers: number;
    active: number;
    purchases_today: number;
    purchases_this_month: number;
    purchase_value_today: number;
    purchase_value_this_month: number;
  }>;
  by_tier?: Array<{
    tier: string;
    customer_count: number;
  }>;
}> {
  const params = city ? { city } : {};
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/dashboard", { params });
  return response.data.data;
}

export async function getCustomers(params?: {
  search?: string;
  status?: string;
  near_deadline?: string;
  city?: string;
  tier?: string;
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

export async function getCustomerLookup(q: string): Promise<{
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
  city: string;
  tier: string;
  status: string;
  points_balance: number;
  lifetime_purchases: number;
  activity_deadline: string | null;
  last_purchase_at: string | null;
  customer?: any;
  profile?: any;
} | null> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/customers/lookup", {
    params: { q }
  });
  const data = response.data.data;
  if (!data) return null;

  const cust = data.customer || data;
  const prof = data.profile || {};
  const tierObj = data.tier || {};

  return {
    ...data,
    id: cust.id || data.id,
    customer_code: cust.customer_code || data.customer_code,
    full_name: prof.full_name || data.full_name || cust.full_name,
    phone: prof.phone || data.phone || cust.phone,
    city: cust.city || data.city,
    status: cust.status || data.status,
    tier: typeof data.tier === "string" ? data.tier : (tierObj.name || data.tier_name || "Bronze"),
    points_balance: cust.points_balance ?? data.points_balance ?? 0,
    lifetime_purchases: cust.lifetime_purchases ?? data.lifetime_purchases ?? 0,
    activity_deadline: cust.activity_deadline || data.activity_deadline || null,
    last_purchase_at: cust.last_transaction_at || data.last_purchase_at || null,
  };
}

export async function getCustomerCities(): Promise<string[]> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/customers/cities");
  const rawData = response.data?.data ?? response.data;
  const list = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.cities)
    ? rawData.cities
    : [];
  return list
    .map((item: any) => (typeof item === "string" ? item : item?.city))
    .filter((city: any): city is string => typeof city === "string" && city.length > 0);
}

export async function getTiers(): Promise<Array<{
  id: string;
  name: string;
  min_lifetime_purchases: number;
  point_value_tzs: number;
}>> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/admin/tiers");
  const rawData = response.data?.data ?? response.data;
  return Array.isArray(rawData) ? rawData : (rawData?.tiers || []);
}

export async function updateTier(
  tierId: string,
  minLifetimePurchases: number,
  pointValueTzs: number
): Promise<any> {
  const response = await apiClient.put<{ success: boolean; data: any }>(
    `/api/admin/tiers/${encodeURIComponent(tierId)}`,
    {
      min_lifetime_purchases: minLifetimePurchases,
      point_value_tzs: pointValueTzs,
    }
  );
  return response.data.data;
}

export async function getCustomerStatement(
  identifier: string,
  from?: string,
  to?: string,
  format?: 'json' | 'csv'
): Promise<any> {
  const params: any = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (format) params.format = format;

  const response = await apiClient.get<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(identifier)}/statement`,
    { params }
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

export async function getAdminCustomerRedemptions(
  customerCode: string,
  params?: { page?: number; limit?: number }
): Promise<{
  redemptions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>(
    `/api/admin/customers/${encodeURIComponent(customerCode)}/redemptions`,
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

export async function previewPurchase(customer: string, purchaseAmount: number): Promise<{
  customer_name: string;
  customer_status: string;
  points_earned: number;
  amount_per_point: number;
  tier_before: string;
  tier_after: string;
  tier_will_change: boolean;
  will_reactivate: boolean;
  old_points_will_expire_first: boolean;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>("/api/admin/purchases/preview", {
    customer,
    purchase_amount: purchaseAmount,
  });
  return response.data.data;
}

export async function recordPurchase(
  customer: string,
  purchaseAmount: number,
  idempotencyKey?: string
): Promise<{
  reference: string;
  points_earned: number;
  new_balance: number;
  customer_status: string;
  duplicate: boolean;
  purchase_id: string;
  tier_after: string;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>("/api/admin/purchases", {
    customer,
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
  redeemable_value_tzs: number;
  waiting_value_tzs: number;
  point_value_tzs: number;
  tier: string;
  lifetime_purchases: number;
  next_tier: string | null;
  next_tier_remaining_tzs: number | null;
  next_tier_point_value_tzs: number | null;
  pending_request: {
    points: number;
    value_tzs: number;
    reference: string;
  } | null;
  next_unlock_at: string | null;
  activity_deadline: string | null;
  days_left: number | null;
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/customer/me/points");
  return response.data.data;
}

export async function createCustomerRedemption(points: number): Promise<{
  redemption_id: string;
  reference: string;
  status: string;
  points: number;
  value_tzs?: number;
}> {
  const response = await apiClient.post<{ success: boolean; data: any }>(
    "/api/customer/me/redemptions",
    { points }
  );
  return response.data.data;
}

export async function getMyPurchases(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  purchases: any[];
  pagination: {
    page: number;
    page_size?: number;
    limit?: number;
    total: number;
    total_pages?: number;
    pages?: number;
    has_next?: boolean;
    has_prev?: boolean;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>(
    "/api/customer/me/purchases",
    { params }
  );
  return response.data.data;
}

export async function getRecentActivity(): Promise<any[]> {
  const response = await apiClient.get<{ success: boolean; data: any }>("/api/customer/me/recent-activity");
  const data = response.data.data;
  return Array.isArray(data) ? data : [];
}

export async function getCustomerRedemptions(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  redemptions: any[];
  pagination: {
    page: number;
    page_size?: number;
    limit?: number;
    total: number;
    total_pages?: number;
    pages?: number;
    has_next?: boolean;
    has_prev?: boolean;
  };
}> {
  const response = await apiClient.get<{ success: boolean; data: any }>(
    "/api/customer/me/redemptions",
    { params }
  );
  return response.data.data;
}

export type AccountDeletionRequest = {
  id: string;
  reason: string | null;
  status: "pending" | "done" | "rejected";
  created_at: string;
  handled_by?: string | null;
  handled_at?: string | null;
  customer_id?: string;
  customer_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  requested_at?: string;
};

export async function getMyAccountDeletionRequest(): Promise<{
  request: AccountDeletionRequest | null;
}> {
  const response = await apiClient.get<{ success: boolean; data: { request: AccountDeletionRequest | null } }>(
    "/api/customer/me/deletion-request"
  );
  return response.data.data;
}

export async function createMyAccountDeletionRequest(
  reason?: string
): Promise<{ request: AccountDeletionRequest }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { request: AccountDeletionRequest };
  }>("/api/customer/me/deletion-request", { reason });
  return response.data.data;
}

export async function getAdminAccountDeletionRequests(status?: string): Promise<{
  requests: AccountDeletionRequest[];
}> {
  const response = await apiClient.get<{
    success: boolean;
    data: { requests: AccountDeletionRequest[] };
  }>("/api/admin/deletion-requests", { params: status ? { status } : {} });
  return response.data.data;
}

export async function reviewAccountDeletionRequest(
  id: string,
  action: "done" | "reject"
): Promise<{ request: AccountDeletionRequest }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { request: AccountDeletionRequest };
  }>(`/api/admin/deletion-requests/${encodeURIComponent(id)}/${action}`, {});
  return response.data.data;
}
