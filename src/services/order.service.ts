import { IdempotencyConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { generateOrderId } from "../utils/id-generator";
import { OrderRepository } from "../repositories/order.repository";
import { IdempotencyRepository } from "../repositories/idempotency.repository";
import { OrderSplitterService } from "./order-splitter.service";
import { MarketSchedulerService } from "./market-scheduler.service";
import { CreateOrderInput, Order, OrderCursor, OrderType } from "../types/order.types";
import Decimal from "decimal.js";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly splitter: OrderSplitterService,
    private readonly scheduler: MarketSchedulerService,
  ) {}

  async create(input: CreateOrderInput, idempotencyKey: string | undefined, partnerId = "default"):
    Promise<{ order: Order; reused: boolean }> {
    const key = idempotencyKey?.trim();
    if (!key) {
      return { order: this.createOrder(input), reused: false };
    }

    const reservation = this.idempotency.reserve(partnerId, key, input);
    if (reservation.status === "conflict") throw new IdempotencyConflictError();
    if (reservation.status === "completed") return { order: reservation.response, reused: true };
    if (reservation.status === "processing") {
      const response = await this.idempotency.wait(partnerId, key);
      if (!response) throw new ValidationError("Idempotency request is still processing.");
      return { order: response, reused: true };
    }

    const order = this.createOrder(input);
    this.idempotency.complete(partnerId, key, input, order);
    return { order, reused: false };
  }

  private createOrder(input: CreateOrderInput): Order {
    const split = this.splitter.split(input);
    const order: Order = {
      orderId: generateOrderId(),
      type: input.type,
      totalAmount: new Decimal(input.totalAmount.toString()).toFixed(2),
      executionTime: this.scheduler.nextExecution(),
      createdAt: new Date().toISOString(),
      orders: split.orders,
      unallocatedAmount: split.unallocatedAmount,
    };
    return this.orders.create(order);
  }

  getById(orderId: string): Order {
    const order = this.orders.findById(orderId);
    if (!order) throw new NotFoundError("Order");
    return order;
  }

  getHistory(limit: number, cursor?: OrderCursor, type?: OrderType, date?: string):
    { data: Order[]; hasMore: boolean; nextCursor?: OrderCursor } {
    const result = this.orders.findPage({ limit, cursor, type, date });
    return {
      data: result.data,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }
}
