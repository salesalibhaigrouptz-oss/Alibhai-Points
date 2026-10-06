import * as SecureStore from "expo-secure-store";
import { ACCESS_TOKEN_KEY } from "./auth-context";

export { ACCESS_TOKEN_KEY };

export function configureApiClient(): void {
  // Mock implementation - configure when backend is ready
  console.log("API client configured");
}

export function getApiBaseUrl(): string | null {
  // Mock implementation - return actual API URL when backend is ready
  return null;
}

export function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 404) {
      return "The Alibhai customer API is not connected yet. Your account data has not been replaced with sample information.";
    }
    if (status === 401) {
      return "Your sign-in has expired. Please sign in again.";
    }
    if (status === 409) {
      return "The server could not complete this request with the current account balance.";
    }
    if (status === 429) {
      return "Majaribio mengi mno. Tafadhali subiri kidogo kisha ujaribu tena. / Too many attempts. Please wait a moment before trying again.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/network error|failed to fetch|network request failed/i.test(message)) {
    return "Hakuna mtandao wa intaneti. Angalia muunganisho wako na ujaribu tena. / No internet connection. Check your connection and try again.";
  }
  if (/not configured/i.test(message)) {
    return "The Alibhai customer API address has not been configured.";
  }
  return message || "Kuna hitilafu imetokea. Tafadhali jaribu tena. / Something went wrong. Please try again.";
}

export type UserProfile = {
  id: string;
  role: "customer" | "admin";
  registered: boolean;
  phoneNumber?: string;
  fullName?: string;
};

export async function fetchMe(token?: string): Promise<UserProfile> {
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to default
    }
  }

  // Mock / default profile
  return {
    id: "me",
    role: "customer",
    registered: true,
  };
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
    value,
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
