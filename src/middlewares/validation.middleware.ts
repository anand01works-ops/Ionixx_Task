import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { ValidationError } from "../utils/errors";

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      next(new ValidationError(
        "Invalid request payload.",
        zodError.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ));
      return;
    }
    request.body = result.data;
    next();
  };
}
