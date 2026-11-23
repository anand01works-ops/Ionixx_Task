export interface AppConfig {
  port: number;
  quantityPrecision: number;
  defaultStockPrice: string;
  marketTimezone: string;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawPrecision = positiveInteger(env.QUANTITY_PRECISION, 3);
  const quantityPrecision = Math.min(7, rawPrecision);
  return {
    port: positiveInteger(env.PORT, 3000),
    quantityPrecision,
    defaultStockPrice: "100",
    marketTimezone: "America/New_York",
  };
}
