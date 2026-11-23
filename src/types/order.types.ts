export type OrderType = "BUY" | "SELL";

export interface PortfolioItemInput {
  symbol: string;
  allocation: number;
  marketPrice?: number;
}

export interface CreateOrderInput {
  type: OrderType;
  totalAmount: number;
  portfolio: PortfolioItemInput[];
}

export interface SplitOrderItem {
  symbol: string;
  allocation: number;
  amount: string;
  price: string;
  quantity: string;
  cost: string;
}

export interface Order {
  orderId: string;
  type: OrderType;
  totalAmount: string;
  executionTime: string;
  createdAt: string;
  orders: SplitOrderItem[];
  unallocatedAmount: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
