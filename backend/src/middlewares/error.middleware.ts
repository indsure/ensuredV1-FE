import type { Request, Response, NextFunction } from "express";
import { wrapError } from "./response.middleware";

export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("API ERROR:", err);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  let code: "VALIDATION_ERROR" | "AI_ERROR" | "NOT_FOUND" | "INTERNAL" = "INTERNAL";
  if (status === 400) code = "VALIDATION_ERROR";
  else if (status === 404) code = "NOT_FOUND";

  res.status(status).json(wrapError(code, message));
}
