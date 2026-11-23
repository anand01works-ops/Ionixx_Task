import { createOrderSchema } from "../../src/validators/order.validator";

describe("order validation", () => {
  test("rejects missing fields", () => {
    expect(createOrderSchema.safeParse({}).success).toBe(false);
  });
  test("rejects zero and negative investment", () => {
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: 0, portfolio: [{ symbol: "A", allocation: 100 }] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: -1, portfolio: [{ symbol: "A", allocation: 100 }] }).success).toBe(false);
  });
  test("rejects invalid price", () => {
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: 10, portfolio: [{ symbol: "A", allocation: 100, marketPrice: 0 }] }).success).toBe(false);
  });
  test.each([99, 101])("rejects allocation %s", (allocation) => {
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: 10, portfolio: [{ symbol: "A", allocation }] }).success).toBe(false);
  });
  test("rejects duplicates and empty portfolio", () => {
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: 10, portfolio: [{ symbol: "A", allocation: 50 }, { symbol: "a", allocation: 50 }] }).success).toBe(false);
    expect(createOrderSchema.safeParse({ type: "BUY", totalAmount: 10, portfolio: [] }).success).toBe(false);
  });
  test("rejects invalid order type", () => {
    expect(createOrderSchema.safeParse({ type: "HOLD", totalAmount: 10, portfolio: [{ symbol: "A", allocation: 100 }] }).success).toBe(false);
  });
});
