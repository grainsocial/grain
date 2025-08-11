import { serveDir } from "@std/http/file-server";
import type { BffContext, BffMiddleware, HttpMethod, RouteHandler } from "../types.d.ts";

/**
 * Creates a route middleware that matches requests to a specific path pattern and HTTP method(s).
 * 
 * @param path - The URL pattern to match against (supports URLPattern syntax)
 * @param methodOrHandler - Either HTTP method(s) or the handler function (defaults to GET if handler provided)
 * @param handler - The route handler function (required if methodOrHandler is not a function)
 * @returns A middleware function that handles matching requests
 * 
 * @example
 * // Simple GET route
 * route("/api/users", async (req, params, ctx) => {
 *   return new Response(JSON.stringify({ users: [] }));
 * })
 * 
 * @example
 * // Route with specific HTTP method
 * route("/api/users", "POST", async (req, params, ctx) => {
 *   const body = await req.json();
 *   return new Response(JSON.stringify({ created: true }));
 * })
 * 
 * @example
 * // Route with multiple HTTP methods
 * route("/api/users/:id", ["GET", "PUT"], async (req, params, ctx) => {
 *   const userId = params.id;
 *   if (req.method === "GET") {
 *     return new Response(JSON.stringify({ id: userId }));
 *   }
 *   return new Response(JSON.stringify({ updated: userId }));
 * })
 * 
 * @example
 * // Route with path parameters
 * route("/api/users/:id/posts/:postId", async (req, params, ctx) => {
 *   const { id, postId } = params;
 *   return new Response(JSON.stringify({ userId: id, postId }));
 * })
 */
export function route(
  path: string,
  methodOrHandler?: HttpMethod | HttpMethod[] | RouteHandler,
  handler?: RouteHandler,
): BffMiddleware {
  let routeMethod: HttpMethod | HttpMethod[] = ["GET"];
  let routeHandler: RouteHandler;

  if (typeof methodOrHandler === "function") {
    routeHandler = methodOrHandler;
  } else if (methodOrHandler) {
    routeMethod = methodOrHandler;
    if (handler) {
      routeHandler = handler;
    } else {
      throw new Error("Handler function is required");
    }
  } else {
    throw new Error("Handler function is required");
  }

  const pattern = new URLPattern({ pathname: path });

  return async (req: Request, ctx: BffContext) => {
    const match = pattern.exec(req.url);

    if (match) {
      const methods = Array.isArray(routeMethod) ? routeMethod : [routeMethod];
      if (methods.includes(req.method as HttpMethod)) {
        const params = Object.fromEntries(
          Object.entries(match.pathname.groups || {})
            .map(([key, value]) => [key, value ?? ""]),
        );

        return await routeHandler(req, params, ctx);
      }
    }

    return await ctx.next();
  };
}

/**
 * Default handler for serving static files from the build directory.
 * 
 * @param req - The incoming HTTP request
 * @param ctx - The BFF context containing configuration
 * @returns A Response serving the requested file or 404 if not found
 * 
 * @example
 * // Used as a fallback handler in middleware chain
 * const middleware = [
 *   route("/api/*", apiHandler),
 *   handler // serves static files from build directory
 * ];
 * 
 * @example
 * // Serves files from /build/ directory
 * // GET /build/app.js -> serves file from rootDir/build/app.js
 * // GET /other -> returns 404
 */
export async function handler(req: Request, ctx: BffContext) {
  const { pathname } = new URL(req.url);

  if (pathname.startsWith(`/${ctx.cfg.buildDir}/`)) {
    return serveDir(req, {
      fsRoot: ctx.cfg.rootDir,
    });
  }

  return new Response("Not found", {
    status: 404,
  });
}

/**
 * Composes multiple handlers into a single handler that executes them in sequence.
 * Each handler can call ctx.next() to pass control to the next handler in the chain.
 * 
 * @param handlers - Array of handler functions to execute in order
 * @returns A composed handler function that runs all handlers in sequence
 * 
 * @example
 * // Basic middleware composition
 * const app = composeHandlers([
 *   route("/api/users", userHandler),
 *   route("/api/posts", postHandler),
 *   handler // fallback static file handler
 * ]);
 * 
 * @example
 * // With authentication middleware
 * const authMiddleware = async (req, ctx) => {
 *   const token = req.headers.get('Authorization');
 *   if (!token) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   return ctx.next(); // continue to next handler
 * };
 * 
 * const app = composeHandlers([
 *   authMiddleware,
 *   route("/api/protected", protectedHandler),
 *   handler
 * ]);
 * 
 * @example
 * // Request flows through handlers until one returns a response
 * // GET /api/users -> userHandler responds
 * // GET /api/posts -> postHandler responds  
 * // GET /build/app.js -> handler serves static file
 * // GET /unknown -> handler returns 404
 */
export function composeHandlers(
  handlers: Array<(req: Request, ctx: BffContext) => Promise<Response>>,
) {
  return (
    request: Request,
    context: BffContext,
  ): Promise<Response> => {
    const handlersToRun = [...handlers];

    async function runNext(): Promise<Response> {
      if (handlersToRun.length === 0) {
        return new Response();
      }

      const currentHandler = handlersToRun.shift()!;
      context.next = runNext;

      return currentHandler(request, context);
    }

    context.next = runNext;
    return runNext();
  };
}