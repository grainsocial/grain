import { assertSnapshot } from "@std/testing/snapshot";
import { renderToString } from "preact-render-to-string";
import { Meta } from "./Meta.tsx";
import type { MetaDescriptor } from "./mod.tsx";

const render = (meta: MetaDescriptor[]) => {
  return renderToString(<Meta meta={meta} />);
};

Deno.test("meta with charSet", async (t) => {
  const result = render([{ charSet: "utf-8" }]);
  await assertSnapshot(t, result);
});

Deno.test("meta with title", async (t) => {
  const result = render([{ title: "Test Title" }]);
  await assertSnapshot(t, result);
});

Deno.test("meta with name and content", async (t) => {
  const result = render([
    { name: "description", content: "Test description" },
  ]);
  await assertSnapshot(t, result);
});

Deno.test("meta with property and content", async (t) => {
  const result = render([
    { property: "og:title", content: "Test Open Graph Title" },
  ]);
  await assertSnapshot(t, result);
});

Deno.test("meta with tagName", async (t) => {
  const result = render([
    { tagName: "link", rel: "stylesheet", href: "/styles.css" },
  ]);
  await assertSnapshot(t, result);
});

Deno.test("meta with invalid tagName", async (t) => {
  const result = render([
    { tagName: "invalid", rel: "stylesheet", href: "/styles.css" },
  ]);
  await assertSnapshot(t, result);
});

Deno.test("meta with multiple descriptors", async (t) => {
  const result = render([
    { charSet: "utf-8" },
    { title: "Test Title" },
    { name: "description", content: "Test description" },
    { property: "og:title", content: "Test Open Graph Title" },
    { tagName: "link", rel: "stylesheet", href: "/styles.css" },
  ]);
  await assertSnapshot(t, result);
});
