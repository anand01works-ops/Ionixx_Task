import { NextFunction, Request, Response } from "express";

export function performanceMiddleware(request: Request, response: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  response.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${elapsedMs.toFixed(2)} ms`);
  });
  next();
}
