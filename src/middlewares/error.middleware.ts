import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";

export function notFoundMiddleware(request: Request, _response: Response, next: NextFunction): void {
  next(new AppError(404, "NOT_FOUND", `Route ${request.method} ${request.path} was not found.`));
}

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  if (isMalformedJson(error)) {
    response.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON.",
      },
    });
    return;
  }

  console.error("Unhandled request error:", error);
  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred.",
    },
  });
}

function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError
    && "type" in error
    && error.type === "entity.parse.failed";
}
