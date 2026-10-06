import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("GET /api/health", () => {
  it("should return 200 with status ok and service metadata", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("status", "ok");
    expect(res.body.data).toHaveProperty("timestamp");
    expect(res.body.data).toHaveProperty("service", "Alibhai Points API");
    expect(res.body.data).toHaveProperty("version", "2.0.0");
  });
});
