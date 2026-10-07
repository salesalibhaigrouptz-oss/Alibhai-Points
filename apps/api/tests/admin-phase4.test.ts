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
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Phase 4 Admin Endpoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Dashboard Metrics Tests ──────────────────────────────────────────────────

  describe("GET /api/admin/dashboard", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const res = await request(app).get("/api/admin/dashboard");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 NOT_ADMIN when a customer tries to access dashboard", async () => {
      mockAuth(CUSTOMER_USER);
      mockFromForAdmin(CUSTOMER_PROFILE);

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", "Bearer customer-token");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_ADMIN");
    });

    it("should return dashboard metrics for admin", async () => {
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
            order: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "point_lots") {
          return {
            select: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "purchases") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "point_redemptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "point_rules") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { inactivity_days: 25 },
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

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("customers");
      expect(res.body.data).toHaveProperty("points");
      expect(res.body.data).toHaveProperty("purchases");
      expect(res.body.data).toHaveProperty("redemptions");
    });
  });

  // ── Customer Status Update Tests ───────────────────────────────────────────

  describe("PATCH /api/admin/customers/:customerCode", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const res = await request(app)
        .patch("/api/admin/customers/TC01")
        .send({ is_active: false });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should disable a customer account", async () => {
      mockAuth(ADMIN_USER);

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await request(app)
        .patch("/api/admin/customers/TC01")
        .set("Authorization", "Bearer admin-token")
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(false);
    });

    it("should enable a customer account", async () => {
      mockAuth(ADMIN_USER);

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await request(app)
        .patch("/api/admin/customers/TC01")
        .set("Authorization", "Bearer admin-token")
        .send({ is_active: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_active).toBe(true);
    });
  });

  // ── Purchase Void Tests ──────────────────────────────────────────────────────

  describe("POST /api/admin/purchases/:id/void", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const res = await request(app)
        .post("/api/admin/purchases/purchase-001/void")
        .send({ reason: "Mistake" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should void a purchase successfully", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: { ok: true, status: "voided" },
        error: null,
      });

      const res = await request(app)
        .post("/api/admin/purchases/purchase-001/void")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "Entered by mistake" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("voided");
    });

    it("should return 400 when reason is empty", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: { ok: false },
        error: { message: "REASON_REQUIRED" },
      });

      const res = await request(app)
        .post("/api/admin/purchases/purchase-001/void")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("REASON_REQUIRED");
    });

    it("should return 400 when points already used or expired", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: { ok: false },
        error: { message: "POINTS_ALREADY_USED_OR_EXPIRED" },
      });

      const res = await request(app)
        .post("/api/admin/purchases/purchase-001/void")
        .set("Authorization", "Bearer admin-token")
        .send({ reason: "Customer requested" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("POINTS_ALREADY_USED_OR_EXPIRED");
    });
  });

  // ── Point Rules Tests ────────────────────────────────────────────────────────

  describe("GET /api/admin/rules", () => {
    it("should return current active point rule", async () => {
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
        if (table === "point_rules") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "rule-001",
                name: "Default Rule",
                amount_per_point: 1000,
                redemption_wait_days: 90,
                inactivity_days: 25,
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

      const res = await request(app)
        .get("/api/admin/rules")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount_per_point).toBe(1000);
      expect(res.body.data.redemption_wait_days).toBe(90);
      expect(res.body.data.inactivity_days).toBe(25);
    });
  });

  describe("PUT /api/admin/rules", () => {
    it("should update point rule for future purchases only", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: { ok: true, rule_id: "new-rule-001" },
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
        if (table === "point_rules") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "new-rule-001",
                name: "Rule 2024-01-01 12:00",
                amount_per_point: 1500,
                redemption_wait_days: 60,
                inactivity_days: 30,
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

      const res = await request(app)
        .put("/api/admin/rules")
        .set("Authorization", "Bearer admin-token")
        .send({
          amount_per_point: 1500,
          redemption_wait_days: 60,
          inactivity_days: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rule.amount_per_point).toBe(1500);
    });

    it("should call update_point_rule RPC with correct parameters", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
        data: { ok: true, rule_id: "new-rule-001" },
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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      await request(app)
        .put("/api/admin/rules")
        .set("Authorization", "Bearer admin-token")
        .send({
          amount_per_point: 2000,
          redemption_wait_days: 45,
          inactivity_days: 20,
        });

      expect(rpcSpy).toHaveBeenCalledWith("update_point_rule", {
        p_admin_id: "u-admin-001",
        p_amount_per_point: 2000,
        p_wait_days: 45,
        p_inactivity_days: 20,
      });
    });
  });

  // ── Audit Logs Tests ────────────────────────────────────────────────────────

  describe("GET /api/admin/audit-logs", () => {
    it("should return audit logs with pagination", async () => {
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
        if (table === "admin_audit_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "log-001",
                  admin_id: "u-admin-001",
                  action: "PIN_RESET",
                  entity_type: "customer",
                  entity_id: "u-cust-001",
                  description: "PIN reset for TC01",
                  metadata: { customer_code: "TC01" },
                  created_at: new Date().toISOString(),
                  profiles: { full_name: "Admin User", phone: "+255712000001" },
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
        .get("/api/admin/audit-logs")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
      expect(res.body.data.logs[0].action).toBe("PIN_RESET");
      expect(res.body.data.pagination).toHaveProperty("page");
      expect(res.body.data.pagination).toHaveProperty("total");
    });

    it("should filter audit logs by action", async () => {
      mockAuth(ADMIN_USER);
      mockFromForAdmin(ADMIN_PROFILE);

      const eqSpy = vi.fn().mockReturnThis();
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
          } as any;
        }
        if (table === "admin_audit_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: eqSpy,
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      await request(app)
        .get("/api/admin/audit-logs?action=PIN_RESET")
        .set("Authorization", "Bearer admin-token");

      expect(eqSpy).toHaveBeenCalledWith("action", "PIN_RESET");
    });
  });

  // ── Reports Summary Tests ─────────────────────────────────────────────────

  describe("GET /api/admin/reports/summary", () => {
    it("should return summary report for date range", async () => {
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
        if (table === "purchases") {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "point_redemptions") {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          } as any;
        }
        if (table === "point_lots") {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await request(app)
        .get("/api/admin/reports/summary?from=2024-01-01&to=2024-01-31")
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("period");
      expect(res.body.data).toHaveProperty("summary");
      expect(res.body.data).toHaveProperty("daily_series");
    });
  });
});
