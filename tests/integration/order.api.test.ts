import request from "supertest";
import { createApp } from "../../src/app";

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
    expect((await request(app).get("/api/v1/orders?page=1&limit=10&type=BUY")).status).toBe(200);
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

  test("clears history in a new app instance", async () => {
    const firstApp = createApp();
    await request(firstApp).post("/api/v1/orders").set("Idempotency-Key", "restart").send(payload);
    expect((await request(firstApp).get("/api/v1/orders")).body.pagination.total).toBe(1);

    const restartedApp = createApp();
    expect((await request(restartedApp).get("/api/v1/orders")).body.pagination.total).toBe(0);
  });
});
