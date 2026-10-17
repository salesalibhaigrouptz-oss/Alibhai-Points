import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { supabase } from "../src/config/supabase.js";

const CUSTOMER_USER = {
  id: "customer-user-id",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const ADMIN_USER = {
  id: "admin-user-id",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const ownRequest = {
  id: "request-id",
  customer_id: "customer-id",
  reason: "Please close my account",
  status: "pending",
  created_at: "2026-05-01T00:00:00.000Z",
};

type Result = { data?: unknown; error?: unknown; count?: number };

function createQuery(result: Result = {}) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
    single: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
    then: (
      resolve: (value: Result) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function mockAuth(
  role: "customer" | "admin",
  fromTable: (table: string) => unknown
) {
  const user = role === "customer" ? CUSTOMER_USER : ADMIN_USER;
  const profile = {
    id: user.id,
    role,
    is_active: true,
    full_name: role === "customer" ? "Test Customer" : "Test Admin",
    customers:
      role === "customer"
        ? { id: "customer-id", customer_code: "TC01" }
        : null,
  };

  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
    data: { user: user as never },
    error: null,
  });
  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
      } as never;
    }
    return fromTable(table) as never;
  });
}

describe("Account deletion request endpoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only the authenticated customer's pending request", async () => {
    const requestQuery = createQuery({ data: ownRequest });
    mockAuth("customer", (table) =>
      table === "account_deletion_requests" ? requestQuery : createQuery()
    );

    const response = await request(app)
      .get("/api/customer/me/deletion-request")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.data.request).toEqual(ownRequest);
    expect(requestQuery.eq).toHaveBeenCalledWith("customer_id", "customer-id");
    expect(requestQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(response.body.data.requests).toBeUndefined();
  });

  it("creates a pending request for the authenticated customer, not a body customer_id", async () => {
    const requestQuery = createQuery({ data: ownRequest });
    requestQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockAuth("customer", (table) =>
      table === "account_deletion_requests" ? requestQuery : createQuery()
    );

    const response = await request(app)
      .post("/api/customer/me/deletion-request")
      .set("Authorization", "Bearer test-token")
      .send({
        reason: "Please close my account",
        customer_id: "somebody-elses-customer-id",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.request).toEqual(ownRequest);
    expect(requestQuery.insert).toHaveBeenCalledWith({
      customer_id: "customer-id",
      reason: "Please close my account",
      status: "pending",
    });
  });

  it("rejects reasons longer than 500 characters", async () => {
    mockAuth("customer", () => createQuery());

    const response = await request(app)
      .post("/api/customer/me/deletion-request")
      .set("Authorization", "Bearer test-token")
      .send({ reason: "r".repeat(501) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns DELETION_ALREADY_REQUESTED when a request is already pending", async () => {
    const requestQuery = createQuery({ data: ownRequest });
    mockAuth("customer", (table) =>
      table === "account_deletion_requests" ? requestQuery : createQuery()
    );

    const response = await request(app)
      .post("/api/customer/me/deletion-request")
      .set("Authorization", "Bearer test-token")
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DELETION_ALREADY_REQUESTED");
    expect(requestQuery.insert).not.toHaveBeenCalled();
  });

  it("lists pending requests with customer contact details for admins", async () => {
    const requestQuery = createQuery({ data: [ownRequest], count: 1 });
    const customersQuery = createQuery({
      data: [
        {
          id: "customer-id",
          customer_code: "TC01",
          profile_id: CUSTOMER_USER.id,
          city: "Arusha",
        },
      ],
    });
    const customerProfilesQuery = createQuery({
      data: [
        {
          id: CUSTOMER_USER.id,
          full_name: "Test Customer",
          phone: "+255700000001",
        },
      ],
    });
    let profilesCalls = 0;
    vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
      data: { user: ADMIN_USER as never },
      error: null,
    });
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles" && profilesCalls++ === 0) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ADMIN_USER.id,
              role: "admin",
              is_active: true,
              customers: null,
            },
            error: null,
          }),
        } as never;
      }
      if (table === "profiles") return customerProfilesQuery as never;
      if (table === "customers") return customersQuery as never;
      return requestQuery as never;
    });

    const response = await request(app)
      .get("/api/admin/deletion-requests?status=pending")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(requestQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(response.body.data.requests).toEqual([
      expect.objectContaining({
        id: ownRequest.id,
        customer_code: "TC01",
        customer_name: "Test Customer",
        customer_phone: "+255700000001",
        customer_city: "Arusha",
        requested_at: ownRequest.created_at,
      }),
    ]);
  });

  it("rejects a customer accessing the admin request list with 403", async () => {
    mockAuth("customer", () => createQuery());

    const response = await request(app)
      .get("/api/admin/deletion-requests?status=pending")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("NOT_ADMIN");
  });

  it.each(["done", "reject"] as const)(
    "lets an admin %s a request and writes an audit row",
    async (action) => {
      const status = action === "done" ? "done" : "rejected";
      const requestQuery = createQuery({
        data: {
          ...ownRequest,
          status,
          handled_by: ADMIN_USER.id,
          handled_at: "2026-05-02T00:00:00.000Z",
        },
      });
      const auditQuery = createQuery();
      mockAuth("admin", (table) =>
        table === "account_deletion_requests" ? requestQuery : auditQuery
      );

      const response = await request(app)
        .post(`/api/admin/deletion-requests/${ownRequest.id}/${action}`)
        .set("Authorization", "Bearer test-token")
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.request.status).toBe(status);
      expect(requestQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status,
          handled_by: ADMIN_USER.id,
          handled_at: expect.any(String),
        })
      );
      expect(auditQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: ADMIN_USER.id,
          action: "DELETION_REQUEST_HANDLED",
          entity_id: ownRequest.id,
          metadata: { customer_id: ownRequest.customer_id, status },
        })
      );
    }
  );
});
