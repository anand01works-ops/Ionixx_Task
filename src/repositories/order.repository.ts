import { Order, OrderCursor, OrderType } from "../types/order.types";

export class OrderRepository {
  private readonly orders = new Map<string, Order>();
  private readonly orderedOrders: Order[] = [];
  private readonly ordersByType: Record<OrderType, Order[]> = {
    BUY: [],
    SELL: [],
  };

  create(order: Order): Order {
    this.orders.set(order.orderId, order);
    this.insertNewestFirst(this.orderedOrders, order);
    this.insertNewestFirst(this.ordersByType[order.type], order);
    return order;
  }

  findById(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  findPage(options: {
    limit: number;
    cursor?: OrderCursor;
    type?: OrderType;
    date?: string;
  }): { data: Order[]; hasMore: boolean; nextCursor?: OrderCursor } {
    const indexedOrders = options.type ? this.ordersByType[options.type] : this.orderedOrders;
    const dateBounds = options.date
      ? { start: `${options.date}T`, end: `${options.date}U` }
      : undefined;
    const start = dateBounds
      ? this.firstCreatedBefore(indexedOrders, dateBounds.end)
      : 0;
    const end = dateBounds
      ? this.firstCreatedBefore(indexedOrders, dateBounds.start)
      : indexedOrders.length;
    const cursorStart = options.cursor
      ? this.firstAfterCursor(indexedOrders, options.cursor)
      : start;
    const pageStart = Math.max(start, cursorStart);
    const page: Order[] = [];

    for (let index = pageStart; index < end && page.length <= options.limit; index += 1) {
      const order = indexedOrders[index];
      if (order === undefined) throw new Error("Order index is inconsistent.");
      page.push(order);
    }

    const hasMore = page.length > options.limit;
    if (hasMore) page.pop();
    const last = page[page.length - 1];
    return {
      data: page,
      hasMore,
      ...(hasMore && last ? { nextCursor: { createdAt: last.createdAt, orderId: last.orderId } } : {}),
    };
  }

  clear(): void {
    this.orders.clear();
    this.orderedOrders.length = 0;
    this.ordersByType.BUY.length = 0;
    this.ordersByType.SELL.length = 0;
  }

  private insertNewestFirst(orders: Order[], order: Order): void {
    let low = 0;
    let high = orders.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const existing = orders[middle];
      if (existing === undefined) throw new Error("Order index is inconsistent.");
      if (this.compareNewestFirst(existing, order) < 0) low = middle + 1;
      else high = middle;
    }
    orders.splice(low, 0, order);
  }

  private compareNewestFirst(left: Order, right: Order): number {
    return right.createdAt.localeCompare(left.createdAt)
      || right.orderId.localeCompare(left.orderId);
  }

  private firstCreatedBefore(orders: Order[], timestamp: string): number {
    let low = 0;
    let high = orders.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const order = orders[middle];
      if (order === undefined) throw new Error("Order index is inconsistent.");
      if (order.createdAt < timestamp) high = middle;
      else low = middle + 1;
    }
    return low;
  }

  private firstAfterCursor(orders: Order[], cursor: OrderCursor): number {
    let low = 0;
    let high = orders.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const order = orders[middle];
      if (order === undefined) {
        throw new Error("Order index is inconsistent.");
      }
      const isAfterCursor = order.createdAt < cursor.createdAt
        || (order.createdAt === cursor.createdAt && order.orderId < cursor.orderId);
      if (isAfterCursor) high = middle;
      else low = middle + 1;
    }
    return low;
  }
}
