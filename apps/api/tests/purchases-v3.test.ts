import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

describe("Admin Purchases API v3", () => {
  const ADMIN_USER = {
    id: "u-admin",
    phone: "+255754123456",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const ADMIN_PROFILE = {
    id: "u-admin",
    full_name: "Admin User",
    phone: "+255754123456",
    role: "admin",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/admin/customers/lookup", () => {
    it("should find customer by ID (AG01)", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_id: "c-1",
          customer_code: "AG01",
          full_name: "Ibrahim Said",
          phone: "+255712345678",
          city: "Arusha",
          status: "active",
          tier: "Bronze",
          point_value_tzs: 30,
          lifetime_purchases: 50000,
          points_balance: 50,
          last_transaction_at: new Date().toISOString(),
          activity_deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const res = await request(app)
        .get("/api/admin/customers/lookup?q=AG01")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_code).toBe("AG01");
      expect(res.body.data.full_name).toBe("Ibrahim Said");
    });

    it("should find customer by phone (+255712345678)", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_id: "c-1",
          customer_code: "AG01",
          full_name: "Ibrahim Said",
          phone: "+255712345678",
          city: "Arusha",
          status: "active",
          tier: "Bronze",
          point_value_tzs: 30,
          lifetime_purchases: 50000,
          points_balance: 50,
          last_transaction_at: new Date().toISOString(),
          activity_deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const res = await request(app)
        .get("/api/admin/customers/lookup?q=+255712345678")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_code).toBe("AG01");
    });

    it("should return 404 for unknown customer", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "CUSTOMER_NOT_FOUND",
        },
        error: null,
      });

      const res = await request(app)
        .get("/api/admin/customers/lookup?q=UNKNOWN")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    });

    it("should reject customer calling lookup (403 NOT_ADMIN)", async () => {
      const CUSTOMER_USER = {
        id: "u-customer",
        phone: "+255712345678",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      const CUSTOMER_PROFILE = {
        id: "u-customer",
        full_name: "Customer",
        phone: "+255712345678",
        role: "customer",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: CUSTOMER_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: CUSTOMER_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await request(app)
        .get("/api/admin/customers/lookup?q=AG01")
        .set("Authorization", "Bearer customer-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_ADMIN");
    });
  });

  describe("POST /api/admin/purchases/preview", () => {
    it("should preview purchase with v3 response format", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_code: "AG01",
          full_name: "Ibrahim Said",
          status: "active",
          points_to_earn: 50,
          tier: "Bronze",
          tier_after: "Bronze",
          tier_will_change: false,
          old_points_will_expire_first: false,
          will_reactivate: false,
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({ customer: "AG01", purchase_amount: 50000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.points_to_earn).toBe(50);
      expect(res.body.data.tier).toBe("Bronze");
      expect(res.body.data.tier_will_change).toBe(false);
    });

    it("should reject invalid idempotency_key format in record", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({ customer: "AG01", purchase_amount: 50000, idempotency_key: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/admin/purchases", () => {
    it("should record purchase with v3 response format", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: ADMIN_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: ADMIN_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          duplicate: false,
          purchase_id: "p-1",
          transaction_reference: "TXN-260115-ABC123",
          points_earned: 50,
          points_balance: 100,
          customer_status: "active",
          tier: "Bronze",
          point_value_tzs: 30,
          tier_changed: false,
          previous_tier: "Bronze",
          lifetime_purchases: 50000,
        },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({ customer: "AG01", purchase_amount: 50000, idempotency_key: "550e8400-e29b-41d4-a716-446655440000" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction_reference).toBe("TXN-260115-ABC123");
      expect(res.body.data.points_earned).toBe(50);
      expect(res.body.data.tier).toBe("Bronze");
      expect(res.body.data.point_value_tzs).toBe(30);
    });

    it("should reject customer calling record purchase (403 NOT_ADMIN)", async () => {
      const CUSTOMER_USER = {
        id: "u-customer",
        phone: "+255712345678",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      const CUSTOMER_PROFILE = {
        id: "u-customer",
        full_name: "Customer",
        phone: "+255712345678",
        role: "customer",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: CUSTOMER_USER as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: CUSTOMER_PROFILE,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer customer-token")
        .send({ customer: "AG01", purchase_amount: 50000, idempotency_key: "550e8400-e29b-41d4-a716-446655440000" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_ADMIN");
    });
  });
});
