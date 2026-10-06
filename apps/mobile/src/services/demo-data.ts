export type DemoRole = "customer" | "admin";
export type DemoStatus = "active" | "inactive";
export type DemoRedemptionStatus = "completed" | "pending" | "rejected";

export type DemoCustomer = {
  id: string;
  customerId: string;
  fullName: string;
  phoneNumber: string;
  status: DemoStatus;
  totalPoints: number;
  redeemablePoints: number;
  pendingPoints: number;
  redeemedPoints: number;
  lastTransactionAt: string | null;
  activityDeadline: string | null;
};

export type DemoPurchase = {
  id: string;
  customerId: string;
  customerName: string;
  purchaseAmount: number;
  pointsEarned: number;
  occurredAt: string;
  recordedBy: string;
};

export type DemoRedemption = {
  id: string;
  customerId: string;
  customerName: string;
  pointsRedeemed: number;
  reference: string;
  status: DemoRedemptionStatus;
  occurredAt: string;
  processedBy: string;
};

export type DemoPointRules = {
  purchaseAmountPerPoint: number;
  redemptionWaitDays: number;
  activityPeriodDays: number;
};

export type DemoAuditEntry = {
  id: string;
  admin: string;
  action: string;
  entity: string;
  description: string;
  occurredAt: string;
};

export type DemoState = {
  customers: DemoCustomer[];
  purchases: DemoPurchase[];
  redemptions: DemoRedemption[];
  rules: DemoPointRules;
  audit: DemoAuditEntry[];
};

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function initialDemoState(): DemoState {
  const now = new Date().toISOString();
  const twelveDaysAgo = daysFromToday(-12);
  const twentyDaysAgo = daysFromToday(-20);
  const oneHundredDaysAgo = daysFromToday(-100);
  const tenDaysAgo = daysFromToday(-10);
  const oneHundredTwentyDaysAgo = daysFromToday(-120);
  const thirtyDaysAgo = daysFromToday(-30);

  return {
    customers: [
      {
        id: "demo-customer-01",
        customerId: "IS01",
        fullName: "Ibrahim",
        phoneNumber: "+255 7XX XXX 101",
        status: "active",
        totalPoints: 850,
        redeemablePoints: 500,
        pendingPoints: 350,
        redeemedPoints: 0,
        lastTransactionAt: now,
        activityDeadline: daysFromToday(25),
      },
      {
        id: "demo-customer-02",
        customerId: "IS02",
        fullName: "Demo Customer Two",
        phoneNumber: "+255 7XX XXX 202",
        status: "active",
        totalPoints: 800,
        redeemablePoints: 200,
        pendingPoints: 600,
        redeemedPoints: 100,
        lastTransactionAt: tenDaysAgo,
        activityDeadline: daysFromToday(15),
      },
      {
        id: "demo-customer-03",
        customerId: "IS03",
        fullName: "Demo Customer Three",
        phoneNumber: "+255 7XX XXX 303",
        status: "inactive",
        totalPoints: 250,
        redeemablePoints: 0,
        pendingPoints: 250,
        redeemedPoints: 0,
        lastTransactionAt: thirtyDaysAgo,
        activityDeadline: daysFromToday(-5),
      },
    ],
    purchases: [
      {
        id: "demo-purchase-001",
        customerId: "IS01",
        customerName: "Ibrahim",
        purchaseAmount: 500_000,
        pointsEarned: 500,
        occurredAt: oneHundredDaysAgo,
        recordedBy: "Demo Admin",
      },
      {
        id: "demo-purchase-002",
        customerId: "IS01",
        customerName: "Ibrahim",
        purchaseAmount: 300_000,
        pointsEarned: 300,
        occurredAt: twentyDaysAgo,
        recordedBy: "Demo Admin",
      },
      {
        id: "demo-purchase-003",
        customerId: "IS01",
        customerName: "Ibrahim",
        purchaseAmount: 50_000,
        pointsEarned: 50,
        occurredAt: now,
        recordedBy: "Demo Admin",
      },
      {
        id: "demo-purchase-004",
        customerId: "IS02",
        customerName: "Demo Customer Two",
        purchaseAmount: 300_000,
        pointsEarned: 300,
        occurredAt: oneHundredTwentyDaysAgo,
        recordedBy: "Demo Admin",
      },
      {
        id: "demo-purchase-005",
        customerId: "IS02",
        customerName: "Demo Customer Two",
        purchaseAmount: 600_000,
        pointsEarned: 600,
        occurredAt: tenDaysAgo,
        recordedBy: "Demo Admin",
      },
      {
        id: "demo-purchase-006",
        customerId: "IS03",
        customerName: "Demo Customer Three",
        purchaseAmount: 250_000,
        pointsEarned: 250,
        occurredAt: thirtyDaysAgo,
        recordedBy: "Demo Admin",
      },
    ],
    redemptions: [
      {
        id: "demo-redemption-001",
        customerId: "IS02",
        customerName: "Demo Customer Two",
        pointsRedeemed: 100,
        reference: "DEMO-RD-001",
        status: "completed",
        occurredAt: twelveDaysAgo,
        processedBy: "Demo Admin",
      },
      {
        id: "demo-redemption-002",
        customerId: "IS01",
        customerName: "Ibrahim",
        pointsRedeemed: 50,
        reference: "DEMO-RD-002",
        status: "pending",
        occurredAt: now,
        processedBy: "Awaiting review",
      },
    ],
    rules: {
      purchaseAmountPerPoint: 1_000,
      redemptionWaitDays: 90,
      activityPeriodDays: 25,
    },
    audit: [
      {
        id: "demo-audit-001",
        admin: "Demo Admin",
        action: "Purchase recorded",
        entity: "IS01",
        description: "Recorded a TZS 50,000 purchase for Ibrahim.",
        occurredAt: now,
      },
      {
        id: "demo-audit-002",
        admin: "Demo Admin",
        action: "Redemption completed",
        entity: "IS02",
        description: "Completed demo redemption DEMO-RD-001.",
        occurredAt: twelveDaysAgo,
      },
    ],
  };
}

export const demoState = initialDemoState();
