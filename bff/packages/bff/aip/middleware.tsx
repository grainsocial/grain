import type { FunctionComponent } from "preact";
import { Login, type LoginProps } from "../components/Login.tsx";
import type {
  AipMiddlewareOptions,
  BffContext,
  BffMiddleware,
} from "../types.d.ts";
import { aipAuthMiddleware } from "./auth.ts";
import { initializeAipOAuthClient } from "./oauth-client.ts";
import {
  aipOauthCallbackHandler,
  aipOauthLoginHandler,
  aipOauthLogoutHandler,
} from "./oauth-routes.ts";

export const AIP_ROUTES = {
  loginPage: "/login",
  login: "/oauth/login",
  callback: "/oauth/callback",
  signup: "/signup",
  logout: "/logout",
};

async function handleLogin(
  req: Request,
  ctx: BffContext,
  LoginComponent: FunctionComponent<LoginProps>,
) {
  // Handle POST requests from login form
  if (req.method === "POST") {
    const formData = await req.formData();
    const handle = formData.get("handle") as string;

    if (handle && typeof handle === "string") {
      // Redirect to OAuth login with handle as login_hint
      const loginUrl = new URL("/oauth/login", req.url);
      loginUrl.searchParams.set("login_hint", handle);
      return ctx.redirect(loginUrl.toString());
    } else {
      return ctx.render(<LoginComponent error="Please enter a valid handle" />);
    }
  }

  // Handle GET requests - proceed with OAuth flow
  return aipOauthLoginHandler(req, {}, ctx);
}

function handleSignup(
  req: Request,
  ctx: BffContext,
  opts?: AipMiddlewareOptions,
) {
  const loginUrl = new URL("/oauth/login", req.url);
  loginUrl.searchParams.set(
    "login_hint",
    opts?.createAccountPdsHost ?? "https://bsky.social",
  );
  return ctx.redirect(loginUrl.toString());
}

export function aip(opts?: AipMiddlewareOptions): BffMiddleware {
  return async (req: Request, ctx: BffContext) => {
    const { pathname } = new URL(req.url);
    const LoginComponent = opts?.LoginComponent ?? Login;

    if (pathname === AIP_ROUTES.login) {
      return handleLogin(req, ctx, LoginComponent);
    }

    if (pathname === AIP_ROUTES.callback) {
      return aipOauthCallbackHandler(opts)(req, {}, ctx);
    }

    if (pathname === AIP_ROUTES.signup) {
      return handleSignup(req, ctx, opts);
    }

    if (pathname === AIP_ROUTES.loginPage) {
      return ctx.render(<LoginComponent />);
    }

    if (pathname === AIP_ROUTES.logout) {
      return aipOauthLogoutHandler(req, {}, ctx);
    }

    // For all other routes, apply AIP auth middleware
    return aipAuthMiddleware(req, ctx);
  };
}

// Initialize AIP OAuth client at module load time
await initializeAipOAuthClient();
