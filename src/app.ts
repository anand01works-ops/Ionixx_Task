import express, { Express } from "express";
import helmet from "helmet";
import { loadConfig } from "./config";
import { OrderRepository } from "./repositories/order.repository";
import { IdempotencyRepository } from "./repositories/idempotency.repository";
import { OrderSplitterService } from "./services/order-splitter.service";
import { MarketSchedulerService } from "./services/market-scheduler.service";
import { OrderService } from "./services/order.service";
import { OrderController } from "./controllers/order.controller";
import { createOrderRoutes } from "./routes/order.routes";
import { performanceMiddleware } from "./middlewares/performance.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";

export interface ApplicationDependencies {
  config?: ReturnType<typeof loadConfig>;
  orderRepository?: OrderRepository;
  idempotencyRepository?: IdempotencyRepository;
  now?: () => Date;
}

export function createApp(dependencies: ApplicationDependencies = {}): Express {
  const config = dependencies.config ?? loadConfig();
  const orderRepository = dependencies.orderRepository ?? new OrderRepository();
  const idempotencyRepository = dependencies.idempotencyRepository ?? new IdempotencyRepository();
  const splitter = new OrderSplitterService(config);
  const scheduler = new MarketSchedulerService(config);
  const service = new OrderService(orderRepository, idempotencyRepository, splitter, scheduler);
  const controller = new OrderController(service, config);

  const app = express();
  app.use(helmet());
  app.use(performanceMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1/orders", createOrderRoutes(controller));
  app.get("/api/v1/config", (_request, response) => {
    response.status(200).json({
      success: true,
      data: {
        quantityPrecision: config.quantityPrecision,
        defaultStockPrice: config.defaultStockPrice,
      },
    });
  });
  app.get("/api/v1/health", (_request, response) => {
    response.status(200).json({
      success: true,
      data: { status: "healthy", timestamp: new Date().toISOString() },
    });
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
