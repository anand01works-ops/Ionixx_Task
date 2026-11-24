import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppConfig } from "../config";
import { OrderService } from "../services/order.service";
import { CreateOrderInput, OrderCursor, OrderType } from "../types/order.types";
import { ValidationError } from "../utils/errors";

const orderCursorSchema = z.object({
  createdAt: z.string().min(1),
  orderId: z.string().min(1),
}).strict();

export class OrderController {
  constructor(
    private readonly service: OrderService,
    private readonly config: Pick<AppConfig, "defaultPageSize" | "maxPageSize">,
  ) {}

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
      if (request.query.page !== undefined) {
        throw new ValidationError("The page query parameter is no longer supported; use cursor pagination.");
      }
      const limit = Math.min(
        this.paginationNumber(request.query.limit, this.config.defaultPageSize),
        this.config.maxPageSize,
      );
      const rawType = typeof request.query.type === "string" ? request.query.type.toUpperCase() : undefined;
      if (rawType && rawType !== "BUY" && rawType !== "SELL") {
        throw new ValidationError("Filter type must be BUY or SELL.");
      }
      const type = rawType as OrderType | undefined;
      const date = typeof request.query.date === "string" ? request.query.date : undefined;
      const cursor = this.decodeCursor(request.query.cursor);
      const result = this.service.getHistory(limit, cursor, type, date);
      response.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          limit,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor ? this.encodeCursor(result.nextCursor) : null,
        },
      });
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

  private decodeCursor(value: unknown): OrderCursor | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      throw new ValidationError("Cursor must be a valid encoded cursor.");
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    } catch {
      throw new ValidationError("Cursor must be a valid encoded cursor.");
    }
    const result = orderCursorSchema.safeParse(decoded);
    if (!result.success) {
      throw new ValidationError("Cursor must be a valid encoded cursor.");
    }
    if (Number.isNaN(Date.parse(result.data.createdAt))) {
      throw new ValidationError("Cursor must be a valid encoded cursor.");
    }
    return result.data;
  }

  private encodeCursor(cursor: OrderCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString("base64url");
  }
}
