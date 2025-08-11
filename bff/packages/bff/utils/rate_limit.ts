import { RateLimitError } from "./errors.ts";
import type { ActorTable, Database } from "../types.d.ts";

/** Rate limiter function with points system to handle multiple rate limits across different endpoints */
export function rateLimit(
  req: Request,
  currentUser: ActorTable | undefined,
  db: Database,
) {
  return (
    options: {
      namespace: string;
      points?: number;
      limit: number;
      window: number;
      key?: string;
    },
  ): boolean => {
    const {
      namespace,
      points = 1,
      limit,
      window: windowMs,
      key: customKey,
    } = options;

    const did = currentUser?.did;
    const limitKey = customKey || did || req.headers.get("x-forwarded-for") ||
      "anonymous";
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    let inTransaction = false;

    try {
      db.exec("BEGIN TRANSACTION");
      inTransaction = true;

      const result = db.prepare(
        `SELECT points, resetAt FROM rate_limit WHERE key = ? AND namespace = ?`,
      ).get(limitKey, namespace) as
        | { points: number; resetAt: string }
        | undefined;

      if (!result) {
        db.prepare(
          `INSERT INTO rate_limit (key, namespace, points, resetAt) VALUES (?, ?, ?, ?)`,
        ).run(limitKey, namespace, points, resetAt.toISOString());

        db.exec("COMMIT");
        inTransaction = false;
        return true;
      }

      const resetTime = new Date(result.resetAt);

      if (now > resetTime) {
        db.prepare(
          `UPDATE rate_limit SET points = ?, resetAt = ? WHERE key = ? AND namespace = ?`,
        ).run(points, resetAt.toISOString(), limitKey, namespace);

        db.exec("COMMIT");
        inTransaction = false;
        return true;
      }

      if (result.points + points > limit) {
        const retryAfter = Math.ceil(
          (resetTime.getTime() - now.getTime()) / 1000,
        );
        throw new RateLimitError(
          `Rate limit exceeded for ${namespace}. Try again in ${
            Math.ceil(
              (resetTime.getTime() - now.getTime()) / 1000,
            )
          } seconds`,
          retryAfter,
        );
      }

      db.prepare(
        `UPDATE rate_limit SET points = points + ? WHERE key = ? AND namespace = ?`,
      ).run(points, limitKey, namespace);

      db.exec("COMMIT");
      inTransaction = false;
      return true;
    } catch (error) {
      if (inTransaction) {
        try {
          db.exec("ROLLBACK");
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
      }

      if (error instanceof RateLimitError) {
        throw error;
      }

      console.error("Rate limit error:", error);
      throw new Error(`Failed to check rate limit for ${namespace}`);
    }
  };
}