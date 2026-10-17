import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMe,
  completeRegistration,
  getDashboardMetrics,
  getCustomers,
  getCustomer,
  getCustomerLookup,
  getCustomerCities,
  getTiers,
  updateTier,
  getCustomerStatement,
  getCustomerPurchases,
  getAdminCustomerRedemptions,
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
  getMyPurchases,
  getCustomerRedemptions as getMyRedemptions,
  resetCustomerPin,
  getRecentActivity,
  getMyAccountDeletionRequest,
  createMyAccountDeletionRequest,
  getAdminAccountDeletionRequests,
  reviewAccountDeletionRequest,
} from "./api";

// Auth hooks
export const useMe = () => {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCompleteRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fullName, city, token }: { fullName: string; city: string; token?: string }) =>
      completeRegistration(fullName, city, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

// Admin hooks
export const useDashboardMetrics = (city?: string) => {
  return useQuery({
    queryKey: ["admin", "dashboard", city],
    queryFn: () => getDashboardMetrics(city),
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useCustomers = (params?: {
  search?: string;
  status?: string;
  near_deadline?: string;
  city?: string;
  tier?: string;
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

export const useCustomerLookup = (q: string) => {
  return useQuery({
    queryKey: ["admin", "customer-lookup", q],
    queryFn: () => getCustomerLookup(q),
    enabled: !!q && q.length >= 2,
    staleTime: 30 * 1000,
  });
};

export const useCustomerCities = () => {
  return useQuery({
    queryKey: ["admin", "customer-cities"],
    queryFn: getCustomerCities,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTiers = () => {
  return useQuery({
    queryKey: ["admin", "tiers"],
    queryFn: getTiers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateTier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tierId, minLifetimePurchases, pointValueTzs }: {
      tierId: string;
      minLifetimePurchases: number;
      pointValueTzs: number;
    }) => updateTier(tierId, minLifetimePurchases, pointValueTzs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tiers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
  });
};

export const useCustomerStatement = (identifier: string, from?: string, to?: string, format?: 'json' | 'csv') => {
  return useQuery({
    queryKey: ["admin", "customer-statement", identifier, from, to, format],
    queryFn: () => getCustomerStatement(identifier, from, to, format),
    enabled: !!identifier,
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

export const useAdminCustomerRedemptions = (customerCode: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ["admin", "customer", customerCode, "redemptions", params],
    queryFn: () => getAdminCustomerRedemptions(customerCode, params),
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
    mutationFn: ({ customer, purchaseAmount }: { customer: string; purchaseAmount: number }) =>
      previewPurchase(customer, purchaseAmount),
  });
};

export const useRecordPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customer,
      purchaseAmount,
      idempotencyKey,
    }: {
      customer: string;
      purchaseAmount: number;
      idempotencyKey?: string;
    }) => recordPurchase(customer, purchaseAmount, idempotencyKey),
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

export const useRecentActivity = () => {
  return useQuery({
    queryKey: ["customer", "recent-activity"],
    queryFn: () => getRecentActivity(),
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useMyAccountDeletionRequest = () => {
  return useQuery({
    queryKey: ["customer", "account-deletion-request"],
    queryFn: getMyAccountDeletionRequest,
    staleTime: 30 * 1000,
  });
};

export const useCreateAccountDeletionRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => createMyAccountDeletionRequest(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customer", "account-deletion-request"],
      });
    },
  });
};

export const useAdminAccountDeletionRequests = (status?: string) => {
  return useQuery({
    queryKey: ["admin", "account-deletion-requests", status],
    queryFn: () => getAdminAccountDeletionRequests(status),
    staleTime: 30 * 1000,
  });
};

export const useReviewAccountDeletionRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "done" | "reject" }) =>
      reviewAccountDeletionRequest(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "account-deletion-requests"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};
