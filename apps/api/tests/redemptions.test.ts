import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

describe("Customer Redemptions API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const makeFakeCustomerUser = (id = "u-cust-123") => ({
    id,
    phone: "+255712345678",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const makeFakeAdminUser = (id = "u-admin-123") => ({
    id,
    phone: "+255712345678",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  });

  const mockCustomerAuth = () => {
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: makeFakeCustomerUser() as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
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
        } as any;
      }
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "c-uuid-1",
              customer_code: "IS01",
              initials: "IS",
              sequence_number: 1,
              status: "active",
              points_balance: 100,
              last_transaction_at: new Date().toISOString(),
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

  describe("POST /api/customer/me/redemptions", () => {
    it("should create a pending redemption request", async () => {
      mockCustomerAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          redemption_id: "r-uuid-1",
          reference: "RDM-261006-ABC123",
          status: "pending",
          points: 50,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 50 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.points).toBe(50);
    });

    it("should reject insufficient redeemable points (409)", async () => {
      mockCustomerAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "INSUFFICIENT_REDEEMABLE_POINTS",
          redeemable_points: 30,
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 50 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("INSUFFICIENT_REDEEMABLE_POINTS");
      expect(res.body.error.message).toContain("Huna point za kutosha");
    });

    it("should reject second pending request (409)", async () => {
      mockCustomerAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "PENDING_REQUEST_EXISTS",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 50 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PENDING_REQUEST_EXISTS");
      expect(res.body.error.message).toContain("Tayari una ombi");
    });

    it("should reject inactive customer (409)", async () => {
      mockCustomerAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "CUSTOMER_INACTIVE",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 50 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CUSTOMER_INACTIVE");
      expect(res.body.error.message).toContain("Mteja hana shughuli");
    });

    it("should reject invalid points (non-integer)", async () => {
      mockCustomerAuth();

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 50.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject zero points", async () => {
      mockCustomerAuth();

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject negative points", async () => {
      mockCustomerAuth();

      const res = await request(app)
        .post("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token")
        .send({ points: -10 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/customer/me/redemptions", () => {
    it("should list customer redemptions", async () => {
      mockCustomerAuth();

      const fromSpy = vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
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
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "c-uuid-1",
                customer_code: "IS01",
                initials: "IS",
                sequence_number: 1,
                status: "active",
                points_balance: 100,
                last_transaction_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          } as any;
        }
        if (table === "point_redemptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "r-uuid-1",
                  redemption_reference: "RDM-261006-ABC123",
                  points_redeemed: 50,
                  source: "customer_request",
                  status: "pending",
                  redeemed_at: new Date().toISOString(),
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
        .get("/api/customer/me/redemptions")
        .set("Authorization", "Bearer customer-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.redemptions).toHaveLength(1);

      fromSpy.mockRestore();
    });
  });
});

describe("Admin Redemptions API", () => {
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

  describe("GET /api/admin/redemptions", () => {
    it("should list redemptions with pending first", async () => {
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
        if (table === "point_redemptions") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "r-uuid-1",
                  redemption_reference: "RDM-261006-ABC123",
                  points_redeemed: 50,
                  source: "customer_request",
                  status: "completed",
                  redeemed_at: new Date().toISOString(),
                  customers: { customer_code: "IS01", initials: "IS" },
                  profiles: { full_name: "Customer User", phone: "+255712345678" },
                },
                {
                  id: "r-uuid-2",
                  redemption_reference: "RDM-261006-DEF456",
                  points_redeemed: 30,
                  source: "customer_request",
                  status: "pending",
                  redeemed_at: new Date().toISOString(),
                  customers: { customer_code: "IS02", initials: "IS" },
                  profiles: { full_name: "Customer Two", phone: "+255754123456" },
                },
              ],
              error: null,
              count: 2,
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
        .get("/api/admin/redemptions")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.redemptions).toHaveLength(2);
      // Pending should be first
      expect(res.body.data.redemptions[0].status).toBe("pending");

      fromSpy.mockRestore();
    });
  });

  describe("POST /api/admin/redemptions/:id/complete", () => {
    it("should complete a pending redemption", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          status: "completed",
          reference: "RDM-261006-ABC123",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/redemptions/r-uuid-1/complete")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("completed");
    });

    it("should reject completing already completed redemption (409)", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "REDEMPTION_NOT_PENDING",
          status: "completed",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/redemptions/r-uuid-1/complete")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("REDEMPTION_NOT_PENDING");
    });
  });

  describe("POST /api/admin/redemptions/:id/cancel", () => {
    it("should cancel a pending redemption", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: true,
          status: "cancelled",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/redemptions/r-uuid-1/cancel")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "Customer changed mind" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("cancelled");
    });

    it("should reject cancelling already cancelled redemption (409)", async () => {
      mockAdminAuth();

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: {
          ok: false,
          code: "REDEMPTION_ALREADY_CANCELLED",
        },
        error: null,
      } as any);

      const res = await request(app)
        .post("/api/admin/redemptions/r-uuid-1/cancel")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "Test" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("REDEMPTION_ALREADY_CANCELLED");
    });
  });

});
