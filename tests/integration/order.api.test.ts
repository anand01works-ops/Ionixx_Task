import request from "supertest";
import { createApp } from "../../src/app";
import { loadConfig } from "../../src/config";

const payload = {
  type: "BUY",
  totalAmount: 1000,
  portfolio: [
    { symbol: "AAPL", allocation: 60 },
    { symbol: "TSLA", allocation: 40, marketPrice: 200 },
  ],
};

describe("Order API", () => {
  test("creates, retrieves, and lists orders", async () => {
    const app = createApp();
    const created = await request(app).post("/api/v1/orders")
      .set("Idempotency-Key", "create-1")
      .send(payload);
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.orders).toHaveLength(2);

    const id = created.body.data.orderId;
    expect((await request(app).get(`/api/v1/orders/${id}`)).status).toBe(200);
    expect((await request(app).get("/api/v1/orders?limit=10&type=BUY")).status).toBe(200);
  });

  test("creates orders without idempotency or partner headers", async () => {
    const app = createApp();
    const first = await request(app).post("/api/v1/orders").send(payload);
    const second = await request(app).post("/api/v1/orders").send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.orderId).not.toBe(second.body.data.orderId);
  });

  test("returns a clear client error for malformed JSON", async () => {
    const response = await request(createApp())
      .post("/api/v1/orders")
      .set("Idempotency-Key", "malformed-json")
      .set("Content-Type", "application/json")
      .send('{"type":"BUY",');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body.error.message).toBe("Request body must contain valid JSON.");
  });

  test("returns completed duplicate response", async () => {
    const app = createApp();
    const first = await request(app).post("/api/v1/orders").set("Idempotency-Key", "same").send(payload);
    const second = await request(app).post("/api/v1/orders").set("Idempotency-Key", "same").send(payload);
    expect(second.status).toBe(200);
    expect(second.body.data.orderId).toBe(first.body.data.orderId);
  });

  test("rejects idempotency payload conflict", async () => {
    const app = createApp();
    await request(app).post("/api/v1/orders").set("Idempotency-Key", "conflict").send(payload);
    const response = await request(app).post("/api/v1/orders").set("Idempotency-Key", "conflict")
      .send({ ...payload, totalAmount: 2000 });
    expect(response.status).toBe(409);
  });

  test("handles simultaneous idempotent requests", async () => {
    const app = createApp();
    const [first, second] = await Promise.all([
      request(app).post("/api/v1/orders").set("Idempotency-Key", "parallel").send(payload),
      request(app).post("/api/v1/orders").set("Idempotency-Key", "parallel").send(payload),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.data.orderId).toBe(second.body.data.orderId);
  });

  test("returns 404 for missing order", async () => {
    const response = await request(createApp()).get("/api/v1/orders/missing");
    expect(response.status).toBe(404);
  });

  test("returns config and health", async () => {
    const app = createApp();
    expect((await request(app).get("/api/v1/config")).status).toBe(200);
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
  });

  test("paginates order history with cursors without duplicates", async () => {
    const app = createApp();
    await Promise.all([
      request(app).post("/api/v1/orders").send(payload),
      request(app).post("/api/v1/orders").send(payload),
      request(app).post("/api/v1/orders").send(payload),
    ]);

    const first = await request(app).get("/api/v1/orders?limit=2");
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.pagination.hasMore).toBe(true);
    expect(first.body.pagination.nextCursor).toEqual(expect.any(String));

    const second = await request(app)
      .get(`/api/v1/orders?limit=2&cursor=${encodeURIComponent(first.body.pagination.nextCursor)}`);
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.pagination.hasMore).toBe(false);
    expect(second.body.pagination.nextCursor).toBeNull();
    const orderIds = [
      ...first.body.data.map((order: { orderId: string }) => order.orderId),
      ...second.body.data.map((order: { orderId: string }) => order.orderId),
    ];
    expect(new Set(orderIds).size).toBe(3);
  });

  test("uses environment-configured history page limits", async () => {
    const config = loadConfig({ DEFAULT_PAGE_SIZE: "1", MAX_PAGE_SIZE: "2" });
    const app = createApp({ config });
    await Promise.all([
      request(app).post("/api/v1/orders").send(payload),
      request(app).post("/api/v1/orders").send(payload),
      request(app).post("/api/v1/orders").send(payload),
    ]);

    expect((await request(app).get("/api/v1/orders")).body.data).toHaveLength(1);
    const capped = await request(app).get("/api/v1/orders?limit=10");
    expect(capped.body.data).toHaveLength(2);
    expect(capped.body.pagination.limit).toBe(2);
  });

  test("fails fast for invalid environment configuration", () => {
    expect(() => loadConfig({ MARKET_TIMEZONE: "not-a-timezone" })).toThrow(
      "Invalid environment configuration",
    );
    expect(() => loadConfig({ DEFAULT_PAGE_SIZE: "10", MAX_PAGE_SIZE: "5" })).toThrow(
      "DEFAULT_PAGE_SIZE must not exceed MAX_PAGE_SIZE",
    );
  });

  test("rejects invalid and legacy page pagination parameters", async () => {
    const app = createApp();
    expect((await request(app).get("/api/v1/orders?cursor=not-valid")).status).toBe(400);
    expect((await request(app).get("/api/v1/orders?page=2")).status).toBe(400);
  });

  test("clears history in a new app instance", async () => {
    const firstApp = createApp();
    await request(firstApp).post("/api/v1/orders").set("Idempotency-Key", "restart").send(payload);
    expect((await request(firstApp).get("/api/v1/orders")).body.data).toHaveLength(1);

    const restartedApp = createApp();
    expect((await request(restartedApp).get("/api/v1/orders")).body.data).toHaveLength(0);
  });
});
