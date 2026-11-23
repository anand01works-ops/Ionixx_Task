import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { validateBody } from "../middlewares/validation.middleware";
import { createOrderSchema } from "../validators/order.validator";

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();
  router.post("/", validateBody(createOrderSchema), controller.create);
  router.get("/", controller.getAll);
  router.get("/:id", controller.getById);
  return router;
}
