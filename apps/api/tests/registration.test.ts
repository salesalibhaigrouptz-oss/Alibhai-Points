import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

// Test domain injected by env.ts when NODE_ENV=test
const TEST_DOMAIN = "test.points.example.com";

/**
 * Builds a Supabase Auth user whose email encodes a Tanzanian phone number in the
 * fake-email format: 255XXXXXXXXX@<AUTH_EMAIL_DOMAIN>.
 *
 * This mirrors how the mobile app signs users up:
 *   email    = `${phoneWithout+}@${AUTH_EMAIL_DOMAIN}`
 *   password = 6-digit PIN
 *
 * The controller calls getVerifiedPhone(user) to decode the phone; request body
 * phone fields are intentionally not accepted.
 */
function makeFakeEmailUser(localPart: string, id = "u-test"): object {
  return {
    id,
    email: `${localPart}@${TEST_DOMAIN}`,
    phone: null, // phone field is empty in the fake-email flow
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
    const fakeUser = makeFakeEmailUser("255712345678", "u-short-name");

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
      .send({ full_name: "A" }); // 1 character, too short!

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject registration when email does not match the fake-email format (400 INVALID_EMAIL_FORMAT)", async () => {
    // User whose email is a real email, not a phone-derived one
    const fakeUser = {
      id: "u-real-email",
      email: "customer@gmail.com",
      phone: null,
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
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Real Person" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_EMAIL_FORMAT");
  });

  it("should generate IS01 for the first customer (Ibrahim Said) with status 201; phone derived from email, not body", async () => {
    // Phone: +255712345678 encoded in email local-part as 255712345678
    const fakeUser = makeFakeEmailUser("255712345678", "u-first-customer");

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
        customer_code: "IS01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      // body phone is intentionally omitted — it must be ignored
      .send({ full_name: "Ibrahim Said" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.customer_code).toBe("IS01");
    expect(res.body.data.customer_id).toBe("c-uuid-1");

    // Verify phone was derived from email, not body
    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-first-customer",
      p_full_name: "Ibrahim Said",
      p_phone: "+255712345678", // decoded from 255712345678@test.points.example.com
    });
  });

  it("should generate AH02 for the second customer (Ali Hassan) with status 201; phone derived from email", async () => {
    // Phone: +255754123456 encoded as 255754123456
    const fakeUser = makeFakeEmailUser("255754123456", "u-second-customer");

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
        customer_code: "AH02",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ali Hassan" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.customer_code).toBe("AH02");

    // Phone decoded from email local-part, not from request body
    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-second-customer",
      p_full_name: "Ali Hassan",
      p_phone: "+255754123456",
    });
  });

  it("should be idempotent: repeated registration returns 200 with created: false and same code", async () => {
    const fakeUser = makeFakeEmailUser("255712345678", "u-repeat-user");

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
        customer_code: "IS01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      .send({ full_name: "Ibrahim Said" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(false);
    expect(res.body.data.customer_code).toBe("IS01");
  });

  it("should ignore any phone field in the request body and derive phone from email only", async () => {
    const fakeUser = makeFakeEmailUser("255712345678", "u-phone-ignore");

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
        customer_code: "IS01",
      },
      error: null,
    } as any);

    const res = await request(app)
      .post("/api/auth/complete-registration")
      .set("Authorization", "Bearer valid-token")
      // Attacker tries to inject a different phone number via body
      .send({ full_name: "Ibrahim Said", phone: "+255999999999" });

    expect(res.status).toBe(201);
    // Phone in RPC call must still be the one decoded from email, not the body phone
    expect(rpcSpy).toHaveBeenCalledWith("create_customer_profile", {
      p_user_id: "u-phone-ignore",
      p_full_name: "Ibrahim Said",
      p_phone: "+255712345678", // from email, not body
    });
  });
});
