import { loadConfig } from "../../src/config";
import { OrderSplitterService } from "../../src/services/order-splitter.service";

describe("OrderSplitterService", () => {
  const split = (input: Parameters<OrderSplitterService["split"]>[0], precision = 3) =>
    new OrderSplitterService({ ...loadConfig(), quantityPrecision: precision }).split(input);

  test("splits a normal BUY order", () => {
    const result = split({
      type: "BUY", totalAmount: 1000,
      portfolio: [
        { symbol: "AAPL", allocation: 60 },
        { symbol: "TSLA", allocation: 40, marketPrice: 200 },
      ],
    });
    expect(result.orders[0]).toMatchObject({ amount: "600.00", price: "100.00", quantity: "6.000" });
    expect(result.orders[1]).toMatchObject({ amount: "400.00", price: "200.00", quantity: "2.000" });
    expect(result.unallocatedAmount).toBe("0.00");
  });

  test("supports SELL and multiple stocks", () => {
    const result = split({
      type: "SELL", totalAmount: 500,
      portfolio: [
        { symbol: "MSFT", allocation: 50, marketPrice: 125 },
        { symbol: "NVDA", allocation: 25, marketPrice: 200 },
        { symbol: "IBM", allocation: 25, marketPrice: 100 },
      ],
    });
    expect(result.orders.map((order) => order.quantity)).toEqual(["2.000", "0.625", "1.250"]);
  });

  test("uses seven-decimal precision", () => {
    const result = split({
      type: "BUY", totalAmount: 1,
      portfolio: [{ symbol: "AAPL", allocation: 100, marketPrice: 3 }],
    }, 7);
    expect(result.orders[0]?.quantity).toBe("0.3333333");
    expect(result.unallocatedAmount).toBe("0.01");
  });

  test("rounds down and reports residual", () => {
    const result = split({
      type: "BUY", totalAmount: 10,
      portfolio: [{ symbol: "ABC", allocation: 100, marketPrice: 3 }],
    });
    expect(result.orders[0]?.quantity).toBe("3.333");
    expect(result.orders[0]?.cost).toBe("9.99");
    expect(result.unallocatedAmount).toBe("0.01");
  });

  test("handles very small investments", () => {
    const result = split({
      type: "BUY", totalAmount: 0.001,
      portfolio: [{ symbol: "PENNY", allocation: 100, marketPrice: 100 }],
    });
    expect(result.orders[0]?.quantity).toBe("0.000");
    expect(result.unallocatedAmount).toBe("0.00");
  });
});
