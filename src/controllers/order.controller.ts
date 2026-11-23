import { NextFunction, Request, Response } from "express";
import { OrderService } from "../services/order.service";
import { CreateOrderInput, OrderType } from "../types/order.types";
import { ValidationError } from "../utils/errors";

export class OrderController {
  constructor(private readonly service: OrderService) {}

  create = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const partnerId = String(request.header("X-Partner-ID") ?? "default");
      const result = await this.service.create(
        request.body as CreateOrderInput,
        request.header("Idempotency-Key"),
        partnerId,
      );
      response.status(result.reused ? 200 : 201).json({ success: true, data: result.order });
    } catch (error) {
      next(error);
    }
  };

  getAll = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const page = this.paginationNumber(request.query.page, 1);
      const limit = Math.min(this.paginationNumber(request.query.limit, 20), 100);
      const rawType = typeof request.query.type === "string" ? request.query.type.toUpperCase() : undefined;
      if (rawType && rawType !== "BUY" && rawType !== "SELL") {
        throw new ValidationError("Filter type must be BUY or SELL.");
      }
      const type = rawType as OrderType | undefined;
      const date = typeof request.query.date === "string" ? request.query.date : undefined;
      const result = this.service.getHistory(page, limit, type, date);
      response.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  };

  getById = (request: Request, response: Response, next: NextFunction): void => {
    try {
      const order = this.service.getById(String(request.params.id));
      response.status(200).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  };

  private paginationNumber(value: unknown, fallback: number): number {
    const parsed = typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return parsed;
  }
}
