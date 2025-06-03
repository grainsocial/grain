import { RouteHandler } from "@bigmoves/bff";

export const handler: RouteHandler = (_req, _params, ctx) => {
  ctx.state.meta = [{ title: "Support — Grain" }];
  return ctx.render(
    <div className="px-4 py-4">
      <h1 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-white">
        Support
      </h1>
      <p className="mb-4 text-zinc-700 dark:text-zinc-300">
        For help, questions, or to report issues, please email us at{" "}
        <a
          href="mailto:support@grain.social"
          className="text-sky-500 hover:underline"
        >
          support@grain.social
        </a>.
      </p>
      <p className="mb-2 text-zinc-700 dark:text-zinc-300">
        You can also review our{" "}
        <a href="/support/terms" className="text-sky-500 hover:underline">
          Terms
        </a>,{" "}
        <a href="/support/privacy" className="text-sky-500 hover:underline">
          Privacy Policy
        </a>, and{" "}
        <a href="/support/copyright" className="text-sky-500 hover:underline">
          Copyright Policy
        </a>.
      </p>
    </div>,
  );
};
