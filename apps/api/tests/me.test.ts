import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

describe("Identity Endpoints (GET /api/me & GET /api/customer/me)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/me", () => {
    it("should return registered: false when user verified OTP but has no profile yet", async () => {
      const fakeUser = {
        id: "u-unregistered",
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

      // No profile in DB yet
      vi.spyOn(supabase, "from").mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const res = await request(app)
        .get("/api/me")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registered).toBe(false);
      expect(res.body.data.user_id).toBe("u-unregistered");
      expect(res.body.data.phone).toBe("+255712345678");
    });

    it("should return registered: true with profile and customer data when customer exists", async () => {
      const fakeUser = {
        id: "u-registered",
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

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "u-registered",
                full_name: "Ibrahim Said",
                phone: "+255712345678",
                role: "customer",
                is_active: true,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                customers: {
                  id: "c-uuid-1",
                  profile_id: "u-registered",
                  customer_code: "AG01",
                  initials: "AG",
                  sequence_number: 1,
                  city: "Arusha",
                  tier: "Bronze",
                  status: "active",
                  points_balance: 150,
                  last_transaction_at: "2026-01-05T00:00:00Z",
                },
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await request(app)
        .get("/api/me")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.registered).toBe(true);
      expect(res.body.data.role).toBe("customer");
      expect(res.body.data.profile.full_name).toBe("Ibrahim Said");
      expect(res.body.data.customer.customer_code).toBe("AG01");
      expect(res.body.data.customer.city).toBe("Arusha");
      expect(res.body.data.customer.tier).toBe("Bronze");
    });
  });

  describe("GET /api/customer/me", () => {
    it("should reject customer/me if registration is incomplete (403 REGISTRATION_REQUIRED)", async () => {
      const fakeUser = {
        id: "u-unregistered",
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
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const res = await request(app)
        .get("/api/customer/me")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_A_CUSTOMER");
    });

    it("should return customer details for verified active customer", async () => {
      const fakeUser = {
        id: "u-customer",
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

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "u-customer",
                full_name: "Ibrahim Said",
                phone: "+255712345678",
                role: "customer",
                is_active: true,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                customers: {
                  id: "c-uuid-1",
                  profile_id: "u-customer",
                  customer_code: "AG01",
                  initials: "AG",
                  sequence_number: 1,
                  city: "Arusha",
                  tier: "Bronze",
                  status: "active",
                  points_balance: 200,
                  last_transaction_at: null,
                  created_at: "2026-01-01T00:00:00Z",
                },
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await request(app)
        .get("/api/customer/me")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.customer_code).toBe("AG01");
      expect(res.body.data.customer.points_balance).toBe(200);
      expect(res.body.data.profile.full_name).toBe("Ibrahim Said");
    });
  });
});
