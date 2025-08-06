import { BffContext, RouteHandler } from "@bigmoves/bff";
import { CopyrightPolicy, PrivacyPolicy, Terms } from "../legal.tsx";
import type { State } from "../state.ts";

export const termsHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.state.meta = [{ title: "Terms — Grain" }];
  return ctx.render(
    <Terms />,
  );
};

export const privacyHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.state.meta = [{ title: "Privacy Policy — Grain" }];
  return ctx.render(
    <PrivacyPolicy />,
  );
};

export const copyrightHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  ctx.state.meta = [{ title: "Copyright Policy — Grain" }];
  return ctx.render(
    <CopyrightPolicy />,
  );
};
