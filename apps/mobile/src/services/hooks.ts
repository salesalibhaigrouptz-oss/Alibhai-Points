import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMe,
  completeRegistration,
  getDashboardMetrics,
  getCustomers,
  getCustomer,
  getCustomerPurchases,
  getPurchases,
  getRedemptions,
  getRedemption,
  completeRedemption,
  cancelRedemption,
  directRedeem,
  previewPurchase,
  recordPurchase,
  getPointRules,
  updatePointRules,
  getAuditLogs,
  updateCustomerStatus,
  voidPurchase,
  getReportsSummary,
  getCustomerPointsSummary,
  createCustomerRedemption,
  getCustomerPurchases as getMyPurchases,
  getCustomerRedemptions as getMyRedemptions,
  resetCustomerPin,
} from "./api";

// Auth hooks
export const useMe = () => {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCompleteRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fullName, token }: { fullName: string; token?: string }) =>
      completeRegistration(fullName, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

// Admin hooks
export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getDashboardMetrics,
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useCustomers = (params?: {
  search?: string;
  status?: string;
  near_deadline?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["admin", "customers", params],
    queryFn: () => getCustomers(params),
    staleTime: 30 * 1000,
  });
};

export const useCustomer = (customerCode: string) => {
  return useQuery({
    queryKey: ["admin", "customer", customerCode],
    queryFn: () => getCustomer(customerCode),
    enabled: !!customerCode,
    staleTime: 30 * 1000,
  });
};

export const useCustomerPurchases = (customerCode: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ["admin", "customer", customerCode, "purchases", params],
    queryFn: () => getCustomerPurchases(customerCode, params),
    enabled: !!customerCode,
    staleTime: 30 * 1000,
  });
};

export const usePurchases = (params?: {
  customer?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["admin", "purchases", params],
    queryFn: () => getPurchases(params),
    staleTime: 30 * 1000,
  });
};

export const useRedemptions = (params?: {
  status?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["admin", "redemptions", params],
    queryFn: () => getRedemptions(params),
    staleTime: 30 * 1000,
  });
};

export const useRedemption = (id: string) => {
  return useQuery({
    queryKey: ["admin", "redemption", id],
    queryFn: () => getRedemption(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
};

export const useCompleteRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeRedemption(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};

export const useCancelRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelRedemption(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};

export const useDirectRedeem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerCode, points }: { customerCode: string; points: number }) =>
      directRedeem(customerCode, points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};

export const usePreviewPurchase = () => {
  return useMutation({
    mutationFn: ({ customerCode, purchaseAmount }: { customerCode: string; purchaseAmount: number }) =>
      previewPurchase(customerCode, purchaseAmount),
  });
};

export const useRecordPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerCode,
      purchaseAmount,
      idempotencyKey,
    }: {
      customerCode: string;
      purchaseAmount: number;
      idempotencyKey?: string;
    }) => recordPurchase(customerCode, purchaseAmount, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};

export const usePointRules = () => {
  return useQuery({
    queryKey: ["admin", "rules"],
    queryFn: getPointRules,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdatePointRules = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: { tzsPerPoint: number; redemptionWaitDays: number; activityPeriodDays: number }) =>
      updatePointRules(rules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "rules"] });
    },
  });
};

export const useAuditLogs = (params?: {
  admin?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["admin", "audit-logs", params],
    queryFn: () => getAuditLogs(params),
    staleTime: 30 * 1000,
  });
};

export const useUpdateCustomerStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerCode, isActive }: { customerCode: string; isActive: boolean }) =>
      updateCustomerStatus(customerCode, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customer"] });
    },
  });
};

export const useVoidPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseId, reason }: { purchaseId: string; reason: string }) =>
      voidPurchase(purchaseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "purchases"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};

export const useReportsSummary = (params?: { from?: string; to?: string }) => {
  return useQuery({
    queryKey: ["admin", "reports", "summary", params],
    queryFn: () => getReportsSummary(params),
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useResetCustomerPin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerCode, newPin }: { customerCode: string; newPin: string }) =>
      resetCustomerPin(customerCode, newPin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
  });
};

// Customer hooks
export const useCustomerPointsSummary = () => {
  return useQuery({
    queryKey: ["customer", "points-summary"],
    queryFn: getCustomerPointsSummary,
    staleTime: 30 * 1000,
  });
};

export const useCreateCustomerRedemption = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (points: number) => createCustomerRedemption(points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", "points-summary"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "redemptions"] });
    },
  });
};

export const useMyPurchases = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ["customer", "purchases", params],
    queryFn: () => getMyPurchases(params),
    staleTime: 30 * 1000,
  });
};

export const useMyRedemptions = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ["customer", "redemptions", params],
    queryFn: () => getMyRedemptions(params),
    staleTime: 30 * 1000,
  });
};
