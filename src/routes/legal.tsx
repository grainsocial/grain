import { BffContext, RouteHandler } from "@bigmoves/bff";
import { CopyrightPolicy, PrivacyPolicy, Terms } from "../legal.tsx";
import type { State } from "../state.ts";

export const termsHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.render(
    <Terms />,
  );
};

export const privacyHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.render(
    <PrivacyPolicy />,
  );
};

export const copyrightHandler: RouteHandler = (
  _req,
  _params,
  ctx: BffContext<State>,
) => {
  return ctx.render(
    <CopyrightPolicy />,
  );
};
