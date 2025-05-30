import { OAUTH_ROUTES, RateLimitError, UnauthorizedError } from "@bigmoves/bff";
import { formatDuration, intervalToDuration } from "date-fns";

export function onError(err: unknown): Response {
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
          ...err.retryAfter && { "Retry-After": err.retryAfter.toString() },
          "Content-Type": "text/plain",
        },
      },
    );
  }
  return new Response("Internal Server Error", {
    status: 500,
  });
}
