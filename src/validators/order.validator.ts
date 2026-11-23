import { z } from "zod";
import Decimal from "decimal.js";

export const createOrderSchema = z.object({
  type: z.enum(["BUY", "SELL"], { message: "Order type must be BUY or SELL." }),
  totalAmount: z.number({ message: "totalAmount is required." })
    .finite("totalAmount must be a finite number.")
    .positive("totalAmount must be greater than zero."),
  portfolio: z.array(z.object({
    symbol: z.string({ message: "Stock symbol is required." })
      .trim().min(1, "Stock symbol must be a non-empty string."),
    allocation: z.number({ message: "allocation is required." })
      .finite("allocation must be a finite number.")
      .positive("Allocation must be greater than zero."),
    marketPrice: z.number().finite("Stock price must be a finite number.")
      .positive("Stock price must be greater than zero.")
      .optional(),
  }).strict()).min(1, "Portfolio must contain at least one stock."),
}).strict().superRefine((order, ctx) => {
  const allocationTotal = order.portfolio.reduce(
    (sum, item) => sum.plus(new Decimal(item.allocation.toString())),
    new Decimal(0),
  );
  if (!allocationTotal.equals(100)) {
    ctx.addIssue({
      code: "custom",
      message: "Total portfolio allocation must equal exactly 100%.",
      path: ["portfolio"],
    });
  }
  const symbols = new Set<string>();
  order.portfolio.forEach((item, index) => {
    const normalized = item.symbol.trim().toUpperCase();
    if (symbols.has(normalized)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate stock symbol: ${item.symbol}.`,
        path: ["portfolio", index, "symbol"],
      });
    }
    symbols.add(normalized);
  });
});
