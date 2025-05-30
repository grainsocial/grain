import { OAUTH_ROUTES, RateLimitError, UnauthorizedError } from "@bigmoves/bff";
import { formatDuration, intervalToDuration } from "date-fns";

function errorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function onError(err: unknown): Response {
  if (err instanceof BadRequestError) {
    return errorResponse(err.message, 400);
  }
  if (err instanceof ServerError) {
    return errorResponse(err.message, 500);
  }
  if (err instanceof NotFoundError) {
    return errorResponse(err.message, 404);
  }
  if (err instanceof UnauthorizedError) {
    const ctx = err.ctx;
    return ctx.redirect(OAUTH_ROUTES.loginPage);
  }
  if (err instanceof RateLimitError) {
    const now = new Date();
    const future = new Date(now.getTime() + (err.retryAfter ?? 0) * 1000);
    const duration = intervalToDuration({ start: now, end: future });
    const formatted = formatDuration(duration, {
      format: ["minutes", "seconds"],
    });
    return new Response(
      `Too many requests. Retry in ${formatted}.`,
      {
        status: 429,
        headers: {
          ...(err.retryAfter && { "Retry-After": err.retryAfter.toString() }),
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
  return errorResponse("Internal Server Error", 500);
}

export class NotFoundError extends Error {
  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export const ServerError = class extends Error {
  constructor(message = "Internal Server Error") {
    super(message);
    this.name = "ServerError";
  }
};

export class BadRequestError extends Error {
  constructor(message: string = "Bad Request") {
    super(message);
    this.name = "BadRequestError";
  }
}
