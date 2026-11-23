import { createHash } from "node:crypto";
import { Order } from "../types/order.types";

export type IdempotencyStatus = "processing" | "completed";
export interface IdempotencyEntry {
  status: IdempotencyStatus;
  payloadHash: string;
  response?: Order;
  waiter?: Promise<Order>;
  resolveWaiter?: (order: Order) => void;
}

export class IdempotencyRepository {
  private readonly entries = new Map<string, IdempotencyEntry>();

  reserve(scope: string, key: string, payload: unknown):
    { status: "reserved" } | { status: "completed"; response: Order } | { status: "conflict" } | { status: "processing" } {
    const payloadHash = this.hash(payload);
    const namespacedKey = `${scope}:${key}`;
    const existing = this.entries.get(namespacedKey);
    if (existing && existing.payloadHash !== payloadHash) return { status: "conflict" };
    if (existing?.status === "completed" && existing.response) {
      return { status: "completed", response: existing.response };
    }
    if (existing) return { status: "processing" };

    let resolveWaiter: ((order: Order) => void) | undefined;
    const waiter = new Promise<Order>((resolve) => {
      resolveWaiter = resolve;
    });
    this.entries.set(namespacedKey, { status: "processing", payloadHash, waiter, resolveWaiter });
    return { status: "reserved" };
  }

  complete(scope: string, key: string, payload: unknown, response: Order): void {
    const namespacedKey = `${scope}:${key}`;
    const existing = this.entries.get(namespacedKey);
    this.entries.set(namespacedKey, {
      status: "completed",
      payloadHash: this.hash(payload),
      response,
      waiter: existing?.waiter,
      resolveWaiter: existing?.resolveWaiter,
    });
    existing?.resolveWaiter?.(response);
  }

  wait(scope: string, key: string): Promise<Order> | undefined {
    return this.entries.get(`${scope}:${key}`)?.waiter;
  }

  clear(): void {
    this.entries.clear();
  }

  private hash(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }
}
