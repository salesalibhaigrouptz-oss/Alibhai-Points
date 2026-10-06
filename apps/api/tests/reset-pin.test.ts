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
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Mock supabase.auth.getUser to return a given user */
function mockAuth(user: object) {
  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: user as any },
    error: null,
  });
}

/**
 * Mock supabase.from() for the authentication middleware chain:
 * profiles table → profileData, customers table → null (not needed for admin).
 */
function mockFromForAdmin(profileData: object | null) {
  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: profileData, error: null }),
      } as any;
    }
    // customers (from auth middleware) or audit_logs — return empty/ok
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Admin PIN Reset (POST /api/admin/customers/:customerCode/reset-pin)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth & role guard tests ──────────────────────────────────────────────

  it("should return 401 when no Authorization header is provided", async () => {
    const res = await request(app).post(
      "/api/admin/customers/TC01/reset-pin"
    );

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 403 NOT_ADMIN when a customer tries to reset a PIN", async () => {
    mockAuth(CUSTOMER_USER);
    mockFromForAdmin(CUSTOMER_PROFILE); // role: customer

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer customer-token")
      .send({ new_pin: "123456" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_ADMIN");
  });

  // ── Validation tests ─────────────────────────────────────────────────────

  it("should return 400 VALIDATION_ERROR when new_pin is missing", async () => {
    mockAuth(ADMIN_USER);
    mockFromForAdmin(ADMIN_PROFILE);

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({}); // no new_pin

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 VALIDATION_ERROR when new_pin is fewer than 6 digits", async () => {
    mockAuth(ADMIN_USER);
    mockFromForAdmin(ADMIN_PROFILE);

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "1234" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 VALIDATION_ERROR when new_pin is more than 6 digits", async () => {
    mockAuth(ADMIN_USER);
    mockFromForAdmin(ADMIN_PROFILE);

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "1234567" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 VALIDATION_ERROR when new_pin contains non-digit characters", async () => {
    mockAuth(ADMIN_USER);
    mockFromForAdmin(ADMIN_PROFILE);

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "12345a" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ── Business-logic tests ─────────────────────────────────────────────────

  it("should return 404 CUSTOMER_NOT_FOUND when customerCode does not exist", async () => {
    mockAuth(ADMIN_USER);

    // profiles (auth middleware) returns admin profile; customers (controller) returns null
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
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    const res = await request(app)
      .post("/api/admin/customers/NOTEXIST/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "654321" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("should reset PIN successfully for admin and return 200 with customer_code", async () => {
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: ADMIN_USER as any },
      error: null,
    });

    vi.spyOn(supabase.auth.admin, "updateUserById").mockResolvedValue({
      data: { user: {} as any },
      error: null,
    });

    // Track how many times 'profiles' has been queried:
    //  - 1st call  → auth middleware → returns ADMIN_PROFILE (role: admin)
    //  - 2nd call  → controller resolves profile_id → returns { id: 'u-cust-001' }
    let profileCallCount = 0;

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        const profileData =
          profileCallCount === 1
            ? ADMIN_PROFILE          // auth middleware
            : { id: "u-cust-001" };  // controller lookup
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
      if (table === "audit_logs") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    const updateSpy = vi.spyOn(supabase.auth.admin, "updateUserById");

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "987654" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer_code).toBe("TC01");

    // Confirm updateUserById was called with the customer's auth user id
    expect(updateSpy).toHaveBeenCalledWith("u-cust-001", { password: "987654" });
  });

  it("should never include the PIN value in the response body", async () => {
    mockAuth(ADMIN_USER);

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: CUSTOMER_ROW, error: null }),
        } as any;
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "u-cust-001" },
            error: null,
          }),
        } as any;
      }
      if (table === "audit_logs") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: ADMIN_PROFILE, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });

    vi.spyOn(supabase.auth.admin, "updateUserById").mockResolvedValue({
      data: { user: {} as any },
      error: null,
    });

    const res = await request(app)
      .post("/api/admin/customers/TC01/reset-pin")
      .set("Authorization", "Bearer admin-token")
      .send({ new_pin: "111222" });

    // The PIN must never appear in the response
    const responseText = JSON.stringify(res.body);
    expect(responseText).not.toContain("111222");
  });
});
