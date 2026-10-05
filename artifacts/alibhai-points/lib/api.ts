import {
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";
import * as SecureStore from "expo-secure-store";
import { ACCESS_TOKEN_KEY } from "@/lib/auth-context";

export function configureApiClient(): void {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  setBaseUrl(domain ? `https://${domain}` : null);
  setAuthTokenGetter(() => SecureStore.getItemAsync(ACCESS_TOKEN_KEY));
}

export function getApiBaseUrl(): string | null {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  return domain ? `https://${domain}` : null;
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
      return "Too many attempts. Please wait a moment and try again.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/network error|failed to fetch|network request failed/i.test(message)) {
    return "Alibhai Points could not reach the customer service. Check your connection and try again.";
  }
  if (/not configured/i.test(message)) {
    return "The Alibhai customer API address has not been configured.";
  }
  return message || "Something went wrong. Please try again.";
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
