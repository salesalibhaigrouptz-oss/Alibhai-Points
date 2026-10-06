import type { User } from "@supabase/supabase-js";

export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  profile_id: string;
  customer_code: string;
  initials: string;
  sequence_number: number;
  last_transaction_at: string | null;
  status: "active" | "inactive";
  points_balance: number;
  created_at: string;
  updated_at: string;
}

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export interface AuthenticatedUser {
  user: User;
  profile: Profile | null;
  customer: Customer | null;
}
