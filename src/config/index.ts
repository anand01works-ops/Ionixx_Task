import { z } from "zod";
import { IANAZone } from "luxon";

export interface AppConfig {
  port: number;
  quantityPrecision: number;
  defaultStockPrice: string;
  marketTimezone: string;
  defaultPageSize: number;
  maxPageSize: number;
}

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  QUANTITY_PRECISION: z.coerce.number().int().min(1).max(7).default(3),
  DEFAULT_STOCK_PRICE: z.string()
    .regex(/^\d+(\.\d+)?$/)
    .refine((value) => Number(value) > 0)
    .default("100"),
  MARKET_TIMEZONE: z.string()
    .refine((value) => IANAZone.isValidZone(value), "must be a valid IANA timezone")
    .default("America/New_York"),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).default(100),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (parsed.data.DEFAULT_PAGE_SIZE > parsed.data.MAX_PAGE_SIZE) {
    throw new Error("Invalid environment configuration: DEFAULT_PAGE_SIZE must not exceed MAX_PAGE_SIZE.");
  }

  return {
    port: parsed.data.PORT,
    quantityPrecision: parsed.data.QUANTITY_PRECISION,
    defaultStockPrice: parsed.data.DEFAULT_STOCK_PRICE,
    marketTimezone: parsed.data.MARKET_TIMEZONE,
    defaultPageSize: parsed.data.DEFAULT_PAGE_SIZE,
    maxPageSize: parsed.data.MAX_PAGE_SIZE,
  };
}
