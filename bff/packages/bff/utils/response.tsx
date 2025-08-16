import type { ComponentChildren, VNode } from "preact";
import { render as renderToString } from "preact-render-to-string";
import type { BffConfig, BffContext, RootProps } from "../types.d.ts";
import { CSS } from "../styles.ts";

export function Root(props: Readonly<RootProps>) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>{props.children}</body>
    </html>
  );
}

export function json() {
  return (
    data: unknown,
    status = 200,
    headers?: Record<string, string>,
  ): Response => {
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...headers },
      status,
    });
  };
}

export function redirect(headers: Headers) {
  return (url: string) => {
    if (headers.get("HX-Request") !== "true") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: url,
        },
      });
    }
    return new Response(null, {
      status: 200,
      headers: {
        "HX-Redirect": url,
      },
    });
  };
}

export function html() {
  return (vnode: VNode, headers?: Record<string, string>) => {
    const str = renderToString(vnode);
    return new Response(
      `<!DOCTYPE html>${str}`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...headers,
        },
      },
    );
  };
}

export function render(ctx: BffContext, cfg: BffConfig) {
  return (children: ComponentChildren, headers?: Record<string, string>) => {
    const RootElement = cfg.rootElement;
    const str = renderToString(<RootElement ctx={ctx}>{children}</RootElement>);
    return new Response(
      `<!DOCTYPE html>${str}`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...headers,
        },
      },
    );
  };
}