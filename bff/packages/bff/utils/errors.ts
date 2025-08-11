import type { BffContext } from "../types.d.ts";

export class UnauthorizedError<T> extends Error {
  ctx: BffContext<T>;
  constructor(message: string, ctx: BffContext<T>) {
    super(message);
    this.name = "UnauthorizedError";
    this.ctx = ctx;
  }
}

export class RateLimitError extends Error {
  readonly retryAfter?: number;
  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "RateLimitError";
    if (retryAfter) {
      this.retryAfter = retryAfter;
    }
  }
}
