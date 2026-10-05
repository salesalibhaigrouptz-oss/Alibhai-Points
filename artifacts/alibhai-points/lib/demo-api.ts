import {
  demoState,
  type DemoAuditEntry,
  type DemoCustomer,
  type DemoPointRules,
  type DemoPurchase,
  type DemoRedemption,
  type DemoStatus,
} from "@/lib/demo-data";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type DemoDashboardSummary = {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  pointsIssued: number;
  redeemablePoints: number;
  redeemedPoints: number;
  todaysTransactions: number;
  todaysPurchaseValue: number;
  recentPurchases: DemoPurchase[];
};

export type CreateDemoPurchaseInput = {
  customerId: string;
  purchaseAmount: number;
  recordedBy: string;
};

export type CreateDemoPurchaseResult = {
  purchase: DemoPurchase;
  customer: DemoCustomer;
};

export type DemoCustomerQuery = {
  search?: string;
  status?: DemoStatus | "all";
  page?: number;
  pageSize?: number;
};

const clone = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const byNewest = <T extends { occurredAt: string }>(a: T, b: T) =>
  new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();

function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 8,
): PageResult<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safePageSize;
  return {
    items: clone(items.slice(start, start + safePageSize)),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  };
}

function currentDayStart(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export const demoApi = {
  async getCustomerDashboard(): Promise<DemoCustomer> {
    const customer = demoState.customers[0];
    if (!customer) throw new Error("The demo customer is not available.");
    return clone(customer);
  },

  async getCustomerProfile(): Promise<DemoCustomer> {
    const customer = demoState.customers[0];
    if (!customer) throw new Error("The demo customer is not available.");
    return clone(customer);
  },

  async listCustomers(query: DemoCustomerQuery = {}): Promise<PageResult<DemoCustomer>> {
    const search = query.search?.trim().toLowerCase() ?? "";
    const status = query.status ?? "all";
    const filtered = demoState.customers.filter((customer) => {
      const matchesStatus = status === "all" || customer.status === status;
      const matchesSearch =
        !search ||
        customer.customerId.toLowerCase().includes(search) ||
        customer.fullName.toLowerCase().includes(search) ||
        customer.phoneNumber.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
    return paginate(filtered, query.page, query.pageSize);
  },

  async getCustomer(customerId: string): Promise<DemoCustomer> {
    const customer = demoState.customers.find(
      (candidate) => candidate.customerId.toLowerCase() === customerId.toLowerCase(),
    );
    if (!customer) throw new Error("No demo customer matches that ID.");
    return clone(customer);
  },

  async getDashboardSummary(): Promise<DemoDashboardSummary> {
    const today = currentDayStart();
    const todaysPurchases = demoState.purchases.filter(
      (purchase) => new Date(purchase.occurredAt).getTime() >= today,
    );
    return {
      totalCustomers: demoState.customers.length,
      activeCustomers: demoState.customers.filter((c) => c.status === "active").length,
      inactiveCustomers: demoState.customers.filter((c) => c.status === "inactive").length,
      pointsIssued: demoState.purchases.reduce((sum, item) => sum + item.pointsEarned, 0),
      redeemablePoints: demoState.customers.reduce((sum, c) => sum + c.redeemablePoints, 0),
      redeemedPoints: demoState.redemptions
        .filter((item) => item.status === "completed")
        .reduce((sum, item) => sum + item.pointsRedeemed, 0),
      todaysTransactions: todaysPurchases.length,
      todaysPurchaseValue: todaysPurchases.reduce(
        (sum, item) => sum + item.purchaseAmount,
        0,
      ),
      recentPurchases: clone([...demoState.purchases].sort(byNewest).slice(0, 4)),
    };
  },

  async listPurchases(
    query: { customerId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<DemoPurchase>> {
    const filtered = [...demoState.purchases]
      .filter((item) => !query.customerId || item.customerId === query.customerId)
      .sort(byNewest);
    return paginate(filtered, query.page, query.pageSize);
  },

  async recordPurchase(input: CreateDemoPurchaseInput): Promise<CreateDemoPurchaseResult> {
    const customer = demoState.customers.find(
      (candidate) => candidate.customerId.toLowerCase() === input.customerId.toLowerCase(),
    );
    if (!customer) throw new Error("No demo customer matches that ID.");
    if (customer.status !== "active") {
      throw new Error("Purchases can only be recorded for an active demo customer.");
    }
    if (!Number.isSafeInteger(input.purchaseAmount) || input.purchaseAmount <= 0) {
      throw new Error("Enter a positive whole-number purchase amount.");
    }
    const ratio = demoState.rules.purchaseAmountPerPoint;
    if (input.purchaseAmount % ratio !== 0) {
      throw new Error(
        `This demo accepts exact multiples of TZS ${ratio.toLocaleString()}; live rounding rules are not configured.`,
      );
    }

    const now = new Date().toISOString();
    const purchase: DemoPurchase = {
      id: `demo-purchase-${String(demoState.purchases.length + 1).padStart(3, "0")}`,
      customerId: customer.customerId,
      customerName: customer.fullName,
      purchaseAmount: input.purchaseAmount,
      pointsEarned: input.purchaseAmount / ratio,
      occurredAt: now,
      recordedBy: input.recordedBy,
    };
    demoState.purchases.unshift(purchase);
    customer.totalPoints += purchase.pointsEarned;
    customer.pendingPoints += purchase.pointsEarned;
    customer.lastTransactionAt = now;
    customer.activityDeadline = new Date(
      Date.now() + demoState.rules.activityPeriodDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    demoState.audit.unshift({
      id: `demo-audit-${String(demoState.audit.length + 1).padStart(3, "0")}`,
      admin: input.recordedBy,
      action: "Purchase recorded",
      entity: customer.customerId,
      description: `Recorded a TZS ${input.purchaseAmount.toLocaleString()} purchase for ${customer.fullName}.`,
      occurredAt: now,
    });
    return { purchase: clone(purchase), customer: clone(customer) };
  },

  async listRedemptions(
    query: { customerId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PageResult<DemoRedemption>> {
    const filtered = [...demoState.redemptions]
      .filter((item) => !query.customerId || item.customerId === query.customerId)
      .sort(byNewest);
    return paginate(filtered, query.page, query.pageSize);
  },

  async getRedemption(redemptionId: string): Promise<DemoRedemption> {
    const redemption = demoState.redemptions.find((item) => item.id === redemptionId);
    if (!redemption) throw new Error("No demo redemption matches that ID.");
    return clone(redemption);
  },

  async requestRedemption(points: number): Promise<DemoRedemption> {
    const customer = demoState.customers[0];
    if (!customer) throw new Error("The demo customer is not available.");
    if (!Number.isSafeInteger(points) || points < 1) {
      throw new Error("Enter a whole number of points greater than zero.");
    }
    if (points > customer.redeemablePoints) {
      throw new Error("The request exceeds the demo redeemable balance.");
    }
    const now = new Date().toISOString();
    const redemption: DemoRedemption = {
      id: `demo-redemption-${String(demoState.redemptions.length + 1).padStart(3, "0")}`,
      customerId: customer.customerId,
      customerName: customer.fullName,
      pointsRedeemed: points,
      reference: `DEMO-RD-${String(demoState.redemptions.length + 1).padStart(3, "0")}`,
      status: "pending",
      occurredAt: now,
      processedBy: "Awaiting review",
    };
    demoState.redemptions.unshift(redemption);
    demoState.audit.unshift({
      id: `demo-audit-${String(demoState.audit.length + 1).padStart(3, "0")}`,
      admin: "Demo Customer",
      action: "Redemption requested",
      entity: customer.customerId,
      description: `Requested ${points} demo points.`,
      occurredAt: now,
    });
    return clone(redemption);
  },

  async getPointRules(): Promise<DemoPointRules> {
    return clone(demoState.rules);
  },

  async updatePointRules(
    rules: DemoPointRules,
    admin = "Demo Admin",
  ): Promise<DemoPointRules> {
    for (const [name, value] of Object.entries(rules)) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive whole number.`);
      }
    }
    const previous = clone(demoState.rules);
    demoState.rules = clone(rules);
    const now = new Date().toISOString();
    demoState.audit.unshift({
      id: `demo-audit-${String(demoState.audit.length + 1).padStart(3, "0")}`,
      admin,
      action: "Point rules updated",
      entity: "Point rules",
      description:
        `Updated future rules: TZS ${previous.purchaseAmountPerPoint}/point, ` +
        `${previous.redemptionWaitDays}-day wait, ${previous.activityPeriodDays}-day activity period.`,
      occurredAt: now,
    });
    return clone(demoState.rules);
  },

  async listAudit(): Promise<DemoAuditEntry[]> {
    return clone(demoState.audit);
  },
};
