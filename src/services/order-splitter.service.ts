import Decimal from "decimal.js";
import { AppConfig } from "../config";
import { CreateOrderInput, SplitOrderItem } from "../types/order.types";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_DOWN });

export class OrderSplitterService {
  constructor(private readonly config: AppConfig) {}

  split(input: CreateOrderInput): { orders: SplitOrderItem[]; unallocatedAmount: string } {
    const total = new Decimal(input.totalAmount.toString());
    let allocatedCost = new Decimal(0);
    const orders = input.portfolio.map((item) => {
      const allocation = new Decimal(item.allocation.toString());
      const allocatedAmount = total.mul(allocation).div(100);
      const price = new Decimal((item.marketPrice ?? Number(this.config.defaultStockPrice)).toString());
      const quantity = allocatedAmount.div(price).toDecimalPlaces(
        this.config.quantityPrecision,
        Decimal.ROUND_DOWN,
      );
      const cost = quantity.mul(price);
      const monetaryCost = cost.toDecimalPlaces(2, Decimal.ROUND_DOWN);
      allocatedCost = allocatedCost.plus(monetaryCost);

      return {
        symbol: item.symbol.trim().toUpperCase(),
        allocation: item.allocation,
        amount: allocatedAmount.toFixed(2),
        price: price.toFixed(2),
        quantity: quantity.toFixed(this.config.quantityPrecision),
        cost: cost.toFixed(2),
      };
    });
    const residual = total.minus(allocatedCost);
    return {
      orders,
      unallocatedAmount: residual.toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2),
    };
  }
}
