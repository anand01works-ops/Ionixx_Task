import { Order } from "../types/order.types";
import { OrderType } from "../types/order.types";

export class OrderRepository {
  private readonly orders = new Map<string, Order>();

  create(order: Order): Order {
    this.orders.set(order.orderId, order);
    return order;
  }

  findById(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  findAll(options: {
    page: number;
    limit: number;
    type?: OrderType;
    date?: string;
  }): { data: Order[]; total: number } {
    let all = Array.from(this.orders.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt));
    if (options.type) all = all.filter((order) => order.type === options.type);
    if (options.date) {
      const date = options.date;
      all = all.filter((order) => order.createdAt.startsWith(date));
    }
    const total = all.length;
    const offset = (options.page - 1) * options.limit;
    return { data: all.slice(offset, offset + options.limit), total };
  }

  clear(): void {
    this.orders.clear();
  }
}
