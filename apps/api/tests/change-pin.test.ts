import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { publicSupabase, supabase } from "../src/config/supabase.js";

const USER = {
  id: "pin-change-user",
  email: "255712345678@test.points.example.com",
  phone: "+255712345678",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const CUSTOMER = {
  id: "pin-change-customer",
  profile_id: USER.id,
  customer_code: "PC01",
  initials: "PC",
  sequence_number: 1,
  city: "Arusha",
  tier: "Bronze",
  status: "active",
  points_balance: 0,
  last_transaction_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let mockUserSequence = 0;

function mockUser(mustChangePin: boolean, userId = `${USER.id}-${++mockUserSequence}`) {
  let currentFlag = mustChangePin;
  const requestUser = { ...USER, id: userId };
  const profile = {
    id: requestUser.id,
    full_name: "Test Customer",
    phone: USER.phone,
    role: "customer",
    is_active: true,
    must_change_pin: currentFlag,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: requestUser as any },
    error: null,
  });
  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: { ...profile, must_change_pin: currentFlag, customers: CUSTOMER },
          error: null,
        })),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(async () => {
            currentFlag = false;
            return { error: null };
          }),
        }),
      } as any;
    }
    if (table === "audit_logs") {
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any;
  });
}

function authHeader() {
  return { Authorization: "Bearer valid-test-token" };
}

describe("Mandatory PIN change", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the flag from GET /api/me and blocks admin and customer routes", async () => {
    mockUser(true, USER.id);

    const me = await request(app).get("/api/me").set(authHeader());
    expect(me.status).toBe(200);
    expect(me.body.data.must_change_pin).toBe(true);

    const admin = await request(app).get("/api/admin/dashboard").set(authHeader());
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("PIN_CHANGE_REQUIRED");

    const customer = await request(app).get("/api/customer/me").set(authHeader());
    expect(customer.status).toBe(403);
    expect(customer.body.error.code).toBe("PIN_CHANGE_REQUIRED");
  });

  it("allows a flagged user to change PIN, clears the flag, and unlocks customer routes", async () => {
    mockUser(true, USER.id);
    vi.spyOn(publicSupabase.auth, "signInWithPassword").mockResolvedValue({
      data: {
        user: { user_metadata: { role: "customer" } } as any,
        session: null,
      },
      error: null,
    } as any);
    const updateSpy = vi.spyOn(supabase.auth.admin, "updateUserById").mockResolvedValue({
      data: { user: {} as any },
      error: null,
    });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    let mustChange = true;
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(async () => ({
            data: {
              id: USER.id,
              full_name: "Test Customer",
              phone: USER.phone,
              role: "customer",
              is_active: true,
              must_change_pin: mustChange,
              customers: CUSTOMER,
            },
            error: null,
          })),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(async () => {
              mustChange = false;
              return { error: null };
            }),
          }),
        } as any;
      }
      if (table === "audit_logs") return { insert: auditInsert } as any;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any;
    });

    const changed = await request(app)
      .post("/api/me/change-pin")
      .set(authHeader())
      .send({ current_pin: "246810", new_pin: "839205" });

    expect(changed.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({
        password: "839205",
        user_metadata: expect.objectContaining({ pin_hash: expect.any(String) }),
      })
    );
    expect(publicSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: USER.email,
      password: "246810",
    });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PIN_CHANGED",
        target_id: USER.id,
        metadata: {},
      })
    );
    expect(JSON.stringify(changed.body)).not.toContain("246810");
    expect(JSON.stringify(changed.body)).not.toContain("839205");

    const unlocked = await request(app).get("/api/customer/me").set(authHeader());
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.error?.code).not.toBe("PIN_CHANGE_REQUIRED");
  });

  it("rejects an incorrect current PIN", async () => {
    mockUser(true);
    vi.spyOn(publicSupabase.auth, "signInWithPassword").mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      } as any,
    });

    const response = await request(app)
      .post("/api/me/change-pin")
      .set(authHeader())
      .send({ current_pin: "000001", new_pin: "839205" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CURRENT_PIN");
  });

  it("requires both PIN values to contain exactly six digits", async () => {
    mockUser(true);
    const response = await request(app)
      .post("/api/me/change-pin")
      .set(authHeader())
      .send({ current_pin: "12345", new_pin: "839205" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["same PIN", "246810", "SAME_PIN"],
    ["repeated digits", "246810", "WEAK_PIN", "777777"],
    ["ascending sequence", "246810", "WEAK_PIN", "123456"],
    ["descending sequence", "246810", "WEAK_PIN", "654321"],
    ["wraparound sequence", "246810", "WEAK_PIN", "789012"],
    ["zero PIN", "246810", "WEAK_PIN", "000000"],
  ])("rejects a %s", async (_label, currentPin, code, newPin = currentPin) => {
    mockUser(true, `${USER.id}-${newPin}-${++mockUserSequence}`);
    vi.spyOn(publicSupabase.auth, "signInWithPassword");
    const response = await request(app)
      .post("/api/me/change-pin")
      .set(authHeader())
      .send({ current_pin: currentPin, new_pin: newPin });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
    expect(publicSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("limits PIN-change attempts to five per user", async () => {
    const uniqueUser = {
      ...USER,
      id: `pin-rate-limit-${Date.now()}`,
    };
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: uniqueUser as any },
      error: null,
    });
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: uniqueUser.id,
              phone: uniqueUser.phone,
              role: "customer",
              is_active: true,
              must_change_pin: true,
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });
    vi.spyOn(publicSupabase.auth, "signInWithPassword").mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" } as any,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post("/api/me/change-pin")
        .set(authHeader())
        .send({ current_pin: "000001", new_pin: "839205" });
      expect(response.status).toBe(400);
    }

    const limited = await request(app)
      .post("/api/me/change-pin")
      .set(authHeader())
      .send({ current_pin: "000001", new_pin: "839205" });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("PIN_CHANGE_RATE_LIMITED");
  });

  it("does not block an unflagged customer", async () => {
    mockUser(false);
    const response = await request(app).get("/api/customer/me").set(authHeader());
    expect(response.status).toBe(200);
    expect(response.body.error?.code).not.toBe("PIN_CHANGE_REQUIRED");
  });
});
