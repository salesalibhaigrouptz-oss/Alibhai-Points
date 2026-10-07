import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

describe("Admin Purchases API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const makeFakeAdminUser = (id = "u-admin-123") => ({
    id,
    phone: "+255712345678",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const makeFakeCustomerUser = (id = "u-cust-123") => ({
    id,
    phone: "+255712345678",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const mockAdminAuth = () => {
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: makeFakeAdminUser() as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "u-admin-123",
              full_name: "Admin User",
              phone: "+255712345678",
              role: "admin",
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any;
    });
  };

  describe("POST /api/admin/purchases/preview", () => {
    it("should preview purchase with 50,000 TZS earning 50 points", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_name: "Ibrahim Said",
          customer_status: "active",
          points_earned: 50,
          amount_per_point: 1000,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.points_earned).toBe(50);
      expect(res.body.data.amount_per_point).toBe(1000);
      expect(res.body.data.customer_name).toBe("Ibrahim Said");
      expect(res.body.data.customer_status).toBe("active");
    });

    it("should preview purchase with 49,999 TZS earning 49 points", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_name: "Test Customer",
          customer_status: "active",
          points_earned: 49,
          amount_per_point: 1000,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 49999,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.points_earned).toBe(49);
    });

    it("should preview purchase with 999 TZS earning 0 points", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          customer_name: "Test Customer",
          customer_status: "active",
          points_earned: 0,
          amount_per_point: 1000,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 999,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.points_earned).toBe(0);
    });

    it("should reject customer trying to preview purchase (403 NOT_ADMIN)", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: makeFakeCustomerUser() as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "u-cust-123",
            full_name: "Customer User",
            phone: "+255712345678",
            role: "customer",
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer customer-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_ADMIN");
    });

    it("should reject zero amount (400 VALIDATION_ERROR)", async () => {
      mockAdminAuth();

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject negative amount (400 VALIDATION_ERROR)", async () => {
      mockAdminAuth();

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: -100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject text amount (400 VALIDATION_ERROR)", async () => {
      mockAdminAuth();

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: "not a number" as any,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject amount with more than 2 decimal places (400 VALIDATION_ERROR)", async () => {
      mockAdminAuth();

      const res = await request(app)
        .post("/api/admin/purchases/preview")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 100.123,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/admin/purchases", () => {
    it("should record purchase with 50,000 TZS earning 50 points", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          duplicate: false,
          purchase_id: "p-uuid-1",
          transaction_reference: "TXN-261006-ABC123",
          points_earned: 50,
          points_balance: 50,
          customer_status: "active",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
          idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.points_earned).toBe(50);
      expect(res.body.data.new_balance).toBe(50);
      expect(res.body.data.reference).toBe("TXN-261006-ABC123");
      expect(res.body.data.duplicate).toBe(false);
    });

    it("should handle duplicate idempotency_key without adding twice", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          duplicate: true,
          purchase_id: "p-uuid-1",
          transaction_reference: "TXN-261006-ABC123",
          points_earned: 50,
          points_balance: 50,
          customer_status: "active",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
          idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicate).toBe(true);
    });

    it("should record purchase with 999 TZS earning 0 points (purchase saved, no lot)", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          duplicate: false,
          purchase_id: "p-uuid-2",
          transaction_reference: "TXN-261006-DEF456",
          points_earned: 0,
          points_balance: 0,
          customer_status: "active",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 999,
          idempotency_key: "550e8400-e29b-41d4-a716-446655440001",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.points_earned).toBe(0);
    });

    it("should reject unknown customer (404 from RPC)", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: null,
        error: { message: "CUSTOMER_NOT_FOUND" },
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "UNKNOWN",
          purchase_amount: 50000,
          idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("RPC_ERROR");
    });

    it("should reject customer trying to record purchase (403 NOT_ADMIN)", async () => {
      vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: { user: makeFakeCustomerUser() as any },
        error: null,
      });

      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "u-cust-123",
            full_name: "Customer User",
            phone: "+255712345678",
            role: "customer",
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      } as any);

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer customer-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
          idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_ADMIN");
    });

    it("should reject invalid UUID for idempotency_key (400 VALIDATION_ERROR)", async () => {
      mockAdminAuth();

      const res = await request(app)
        .post("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token")
        .send({
          customer_code: "IS01",
          purchase_amount: 50000,
          idempotency_key: "not-a-uuid",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/admin/purchases", () => {
    it("should list purchases with pagination", async () => {
      mockAdminAuth();

      const fromSpy = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "u-admin-123",
                full_name: "Admin User",
                phone: "+255712345678",
                role: "admin",
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          } as any;
        }
        if (table === "purchases") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "p-uuid-1",
                  transaction_reference: "TXN-261006-ABC123",
                  purchase_amount: 50000,
                  points_earned: 50,
                  amount_per_point_used: 1000,
                  status: "completed",
                  purchased_at: new Date().toISOString(),
                  customers: { customer_code: "IS01", initials: "IS" },
                  profiles: { full_name: "Ibrahim Said" },
                },
              ],
              error: null,
              count: 1,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases).toHaveLength(1);
      expect(res.body.data.pagination.total).toBe(1);

      fromSpy.mockRestore();
    });
  });
});
