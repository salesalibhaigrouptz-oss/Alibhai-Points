import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

/**
 * Builds a Supabase Auth user with a phone number.
 * Phone-based flow only - no email involved.
 */
function makePhoneUser(phone: string, id = "u-test"): object {
  return {
    id,
    phone: phone,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}

describe("Customer Registration (POST /api/auth/complete-registration)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject registration when name is too short (400 VALIDATION_ERROR)", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-short-name");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "A", city: "Arusha" }); // 1 character, too short!

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject registration when city is too short (400 VALIDATION_ERROR)", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-short-city");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ibrahim Said", city: "A" }); // 1 character, too short!

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should generate AG01 for the first customer with status 201", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-first-customer");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        ok: true,
        created: true,
        customer_id: "c-uuid-1",
        customer_code: "AG01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ibrahim Said", city: "arusha" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.customer_code).toBe("AG01");
    expect(res.body.data.customer_id).toBe("c-uuid-1");

    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-first-customer",
      p_full_name: "Ibrahim Said",
      p_phone: "+255712345678",
      p_city: "arusha",
    });
  });

  it("should generate AG02 for the second customer with status 201", async () => {
    const fakeUser = makePhoneUser("+255754123456", "u-second-customer");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        ok: true,
        created: true,
        customer_id: "c-uuid-2",
        customer_code: "AG02",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ali Hassan", city: "dar es salaam" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.customer_code).toBe("AG02");

    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-second-customer",
      p_full_name: "Ali Hassan",
      p_phone: "+255754123456",
      p_city: "dar es salaam",
    });
  });

  it("should be idempotent: repeated registration returns 200 with created: false and same code", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-repeat-user");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    // SQL returns created: false when already registered
    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        ok: true,
        created: false,
        customer_id: "c-uuid-1",
        customer_code: "AG01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ibrahim Said", city: "arusha" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(false);
    expect(res.body.data.customer_code).toBe("AG01");
  });

  it("should ignore any phone field in the request body and use phone from user record", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-phone-ignore");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: {
        ok: true,
        created: true,
        customer_id: "c-uuid-ignored",
        customer_code: "AG01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      // Don't send phone in body - it should come from user record
      .send({ full_name: "Ibrahim Said", city: "arusha" });

    expect(res.status).toBe(201);
    // Phone in RPC call must be from user record
    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-phone-ignore",
      p_full_name: "Ibrahim Said",
      p_phone: "+255712345678", // from user record
      p_city: "arusha",
    });
  });

  it("should reject complete-registration for admin accounts (403 NOT_A_CUSTOMER)", async () => {
    const fakeUser = makePhoneUser("+255712345678", "u-admin");

    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: fakeUser as any },
      error: null,
    });

    // Admin profile exists
    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "u-admin",
          full_name: "Admin User",
          phone: "+255712345678",
          role: "admin",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Admin User", city: "Dar es Salaam" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_A_CUSTOMER");
  });
});
