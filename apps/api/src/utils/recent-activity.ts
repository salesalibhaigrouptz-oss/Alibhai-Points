export type RecentActivityItem = {
  type: "purchase" | "redemption" | string;
  at: string | null;
  amount_tzs: number | null;
  points: number;
  reference: string | null;
  status: string | null;
  value_tzs: number | null;
};

export function normalizeRecentActivity(data: unknown, limit = 5): RecentActivityItem[] {
  if (Array.isArray(data)) {
    return data.slice(0, limit);
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const obj = data as {
    purchases?: any[];
    redemptions?: any[];
  };

  const purchases = (obj.purchases || []).map((purchase) => ({
    type: "purchase" as const,
    at: purchase.purchased_at ?? purchase.at ?? null,
    amount_tzs: purchase.purchase_amount ?? purchase.amount_tzs ?? null,
    points: purchase.points_earned ?? purchase.points ?? 0,
    reference: purchase.transaction_reference ?? purchase.reference ?? null,
    status: purchase.status ?? null,
    value_tzs: purchase.value_tzs ?? null,
  }));

  const redemptions = (obj.redemptions || []).map((redemption) => ({
    type: "redemption" as const,
    at: redemption.redeemed_at ?? redemption.at ?? null,
    amount_tzs: redemption.amount_tzs ?? null,
    points: redemption.points_redeemed ?? redemption.points ?? 0,
    reference: redemption.redemption_reference ?? redemption.reference ?? null,
    status: redemption.status ?? null,
    value_tzs: redemption.value_tzs ?? null,
  }));

  return [...purchases, ...redemptions]
    .sort((a, b) => {
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}
