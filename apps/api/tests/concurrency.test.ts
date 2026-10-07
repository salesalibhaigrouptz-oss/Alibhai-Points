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

const CUSTOMER_ROW = {
  id: "c-uuid-001",
  profile_id: "u-cust-001",
  customer_code: "TC01",
  status: "active",
  points_balance: 1000,
  last_transaction_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockAuth(user: object) {
  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: user as any },
    error: null,
  });
}

function mockFromForAdmin(profileData: object | null) {
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

// ─── Concurrency Protection Tests ────────────────────────────────────────────

describe("Concurrency Protection - Phase 5 Production Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Parallel Purchases: Idempotency key prevents double spending ─────────────

  describe("Parallel Purchases: Idempotency key prevents double spending", () => {
    it("should prevent duplicate purchases with same idempotency key", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      // First call: new purchase
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          ok: true,
          duplicate: false,
          purchase_id: "purchase-001",
          transaction_reference: "TXN-241001-ABC123",
          points_earned: 50,
          points_balance: 1050,
          customer_status: "active",
        },
        error: null,
      });

      // Second call with same idempotency key: returns existing
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          ok: true,
          duplicate: true,
          purchase_id: "purchase-001",
          transaction_reference: "TXN-241001-ABC123",
          points_earned: 50,
          points_balance: 1050,
          customer_status: "active",
        },
        error: null,
      });

      const purchaseData = {
        customer_code: "TC01",
        purchase_amount: 50000,
        idempotency_key: "same-idempotency-key",
      };

      // Simulate parallel requests
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/admin/purchases")
          .set("Authorization", "Bearer admin-token")
          .send(purchaseData),
        request(app)
          .post("/api/admin/purchases")
          .set("Authorization", "Bearer admin-token")
          .send(purchaseData),
      ]);

      // Both should succeed, but only one should create a new purchase
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // One should be a duplicate
      const hasDuplicate = res1.body.data.duplicate || res2.body.data.duplicate;
      expect(hasDuplicate).toBe(true);

      // Both should return the same purchase_id
      expect(res1.body.data.purchase_id).toBe(res2.body.data.purchase_id);
    });
  });

  // ── Parallel Redemptions: Cannot create negative balance ───────────────────

  describe("Parallel Redemptions: Cannot create negative balance", () => {
    it("should prevent parallel redemptions that would exceed balance", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      // Customer has 1000 points
      const customerWithBalance = {
        ...CUSTOMER_ROW,
        points_balance: 1000,
      };

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
            maybeSingle: vi.fn().mockResolvedValue({ data: customerWithBalance, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      // First redemption: 600 points (succeeds)
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          ok: true,
          redemption_id: "redemption-001",
          reference: "RDM-241001-XYZ789",
          status: "completed",
          points: 600,
        },
        error: null,
      });

      // Second redemption: 600 points (should fail - only 400 remaining)
      vi.spyOn(supabase, "rpc").mockResolvedValueOnce({
        data: {
          ok: false,
          code: "INSUFFICIENT_REDEEMABLE_POINTS",
          redeemable_points: 400,
        },
        error: null,
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/admin/customers/TC01/redeem")
          .set("Authorization", "Bearer admin-token")
          .send({ points: 600 }),
        request(app)
          .post("/api/admin/customers/TC01/redeem")
          .set("Authorization", "Bearer admin-token")
          .send({ points: 600 }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("INSUFFICIENT_REDEEMABLE_POINTS");
    });
  });

  // ── Concurrent Read/Write: Customer data locked during operations ─────────────

  describe("Concurrent Read/Write: Database locks prevent race conditions", () => {
    it("should handle concurrent customer updates safely", async () => {
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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      };
    });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          purchase_id: "purchase-001",
          transaction_reference: "TXN-241001-ABC123",
          points_earned: 50,
          points_balance: 1050,
          customer_status: "active",
        },
        error: null,
      });

      // Simulate concurrent operations
      const [purchaseRes, customerRes] = await Promise.all([
        request(app)
          .post("/api/admin/purchases")
          .set("Authorization", "Bearer admin-token")
          .send({
            customer_code: "TC01",
            purchase_amount: 50000,
            idempotency_key: "idempotency-key-1",
          }),
        request(app)
          .get("/api/admin/customers/TC01")
          .set("Authorization", "Bearer admin-token"),
      ]);

      expect(purchaseRes.status).toBe(200);
      expect(customerRes.status).toBe(200);
    });
  });
});
