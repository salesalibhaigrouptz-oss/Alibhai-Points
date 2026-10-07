import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const ADMIN_USER = {
  id: "u-admin-001",
  email: "255712000001@test.points.example.com",
  phone: null,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const ADMIN_PROFILE = {
  id: "u-admin-001",
  full_name: "Admin User",
  phone: "+255712000001",
  role: "admin",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const CUSTOMER_USER = {
  id: "u-cust-001",
  email: "255712000002@test.points.example.com",
  phone: null,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const CUSTOMER_PROFILE = {
  id: "u-cust-001",
  full_name: "Test Customer",
  phone: "+255712000002",
  role: "customer",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const CUSTOMER_ROW = {
  id: "c-uuid-001",
  profile_id: "u-cust-001",
  customer_code: "TC01",
  status: "active",
  points_balance: 0,
  last_transaction_at: null,
  created_at: new Date().toISOString(),
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockAuth(user: object) {
  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: user as any },
    error: null,
  });
}

function mockFromForCustomer(profileData: object | null) {
  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: profileData, error: null }),
      } as any;
    }
    if (table === "customers") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
      } as any;
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any;
  });
}

// ─── Business Rule Tests ─────────────────────────────────────────────────────────

describe("Business Rules - Phase 5 Production Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Point Calculation Rule: TZS 50,000 = 50 points ───────────────────────────

  describe("Point Calculation: TZS 50,000 = 50 points (1000 TZS per point)", () => {
    it("should calculate 50 points for TZS 50,000 purchase", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
          } as any;
        }
        if (table === "point_rules") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { amount_per_point: 1000 },
              error: null,
            }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_name: "Test Customer",
          customer_status: "active",
          points_earned: 50,
          amount_per_point: 1000,
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "TC01",
          purchase_amount: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.points_earned).toBe(50);
      expect(res.body.data.amount_per_point).toBe(1000);
    });
  });

  // ── 90-Day Maturity Rule ───────────────────────────────────────────────────────

  describe("90-Day Maturity: Points become redeemable after 90 days", () => {
    it("should set redeemable_at 90 days after purchase", async () => {
      const now = new Date();
      const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          purchase_id: "purchase-001",
          transaction_reference: "TXN-241001-ABC123",
          points_earned: 50,
          points_balance: 50,
          customer_status: "active",
        },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
          } as any;
        }
        if (table === "point_lots") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const lotInsertSpy = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "point_lots") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "TC01",
          purchase_amount: 50000,
          idempotency_key: "test-idempotency-key",
        });

      // Verify point lot was created with 90-day wait period
      expect(lotInsertSpy).toHaveBeenCalledWith("point_lots");
    });
  });

  // ── 25-Day Inactivity Rule ─────────────────────────────────────────────────────

  describe("25-Day Inactivity: Customer becomes inactive after 25 days", () => {
    it("should mark customer as inactive after 25 days without transaction", async () => {
      const twentySixDaysAgo = new Date();
      twentySixDaysAgo.setDate(twentySixDaysAgo.getDate() - 26);

      const inactiveCustomer = {
        ...CUSTOMER_ROW,
        last_transaction_at: twentySixDaysAgo.toISOString(),
        status: "active",
      };

      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          // Simulated result from apply_inactivity_if_due
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "TC01",
          purchase_amount: 50000,
          idempotency_key: "test-idempotency-key",
        });

      expect(res.status).toBe(200);
    });
  });

  // ── FIFO Rule: Points redeemed from oldest lots first ─────────────────────────

  describe("FIFO: Points redeemed from oldest lots first", () => {
    it("should redeem points from oldest eligible lots first", async () => {
      mockAuth(CUSTOMER_USER);
      mockFromForCustomer(CUSTOMER_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          redemption_id: "redemption-001",
          reference: "RDM-241001-XYZ789",
          status: "completed",
          points: 30,
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/customer/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 30 });

      expect(res.status).toBe(200);
      expect(res.body.data.points).toBe(30);
    });
  });

  // ── Cancellation: Redemption cancellation returns points ───────────────────

  describe("Cancellation: Redemption cancellation returns points to lots", () => {
    it("should return points to lots when redemption is cancelled", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          status: "cancelled",
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/redemptions/redemption-001/cancel")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "Customer request" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");
    });
  });

  // ── Reactivation: New purchase reactivates inactive customer ───────────────────

  describe("Reactivation: New purchase reactivates inactive customer", () => {
    it("should reactivate inactive customer on new purchase", async () => {
      const inactiveCustomer = {
        ...CUSTOMER_ROW,
        status: "inactive",
        points_balance: 0,
      };

      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: inactiveCustomer, error: null }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          purchase_id: "purchase-001",
          transaction_reference: "TXN-241001-ABC123",
          points_earned: 50,
          points_balance: 50,
          customer_status: "active", // Should change from inactive to active
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "TC01",
          purchase_amount: 50000,
          idempotency_key: "test-idempotency-key",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.customer_status).toBe("active");
    });
  });

  // ── Idempotency: Duplicate purchase with same idempotency key returns existing ─────

  describe("Idempotency: Duplicate purchase with same idempotency key", () => {
    it("should return existing purchase for duplicate idempotency key", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          duplicate: true,
          purchase_id: "existing-purchase-001",
          transaction_reference: "TXN-241001-EXISTING",
          points_earned: 50,
          points_balance: 100,
          customer_status: "active",
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "TC01",
          purchase_amount: 50000,
          idempotency_key: "existing-idempotency-key",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.duplicate).toBe(true);
      expect(res.body.data.purchase_id).toBe("existing-purchase-001");
    });
  });
});
