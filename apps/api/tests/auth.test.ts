import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

describe("Auth Middleware & Role Guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject request with missing Authorization header (401 UNAUTHORIZED)", async () => {
    const res = await request(app).get("/api/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject request with malformed Bearer token (401 UNAUTHORIZED)", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Basic invalid-format");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject request when Supabase token is invalid or expired (401 INVALID_TOKEN)", async () => {
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT", status: 401, name: "AuthApiError" } as any,
    });

    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("should reject request when user profile is disabled with is_active = false (403 ACCOUNT_DISABLED)", async () => {
    const fakeUser = {
      id: "u-disabled-123",
      phone: "+255712345678",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "u-disabled-123",
          full_name: "Disabled Customer",
          phone: "+255712345678",
          role: "customer",
          is_active: false, // disabled profile
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any);

    const res = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("should block customer from an admin route (403 NOT_ADMIN)", async () => {
    const fakeCustomerUser = {
      id: "u-cust-123",
      phone: "+255712345678",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeCustomerUser as any },
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
              role: "customer", // customer role, NOT admin
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
      .get("/api/admin/dashboard")
      .set("Authorization", "Bearer customer-token");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_ADMIN");
  });

  it("should allow admin on admin route (200 OK)", async () => {
    const fakeAdminUser = {
      id: "u-admin-123",
      phone: "+255712345678",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeAdminUser as any },
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
              role: "admin", // admin role
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
      .get("/api/admin/dashboard")
      .set("Authorization", "Bearer admin-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe("Welcome to Admin Dashboard");
  });
});
