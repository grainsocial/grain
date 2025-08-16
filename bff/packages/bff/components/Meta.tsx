import type { JSX } from "preact";

export type MetaDescriptor =
  | { charSet: "utf-8" }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { tagName: "meta" | "link"; [name: string]: string }
  | { [name: string]: unknown };

/**
 * Meta component for setting meta tags in the document head.
 *
 * @example
 * ```tsx
 * <Meta
 *   meta={[
 *     { charset: "utf-8" },
 *     { title: "My Page Title" },
 *     { name: "description", content: "My page description" },
 *     { property: "og:title", content: "My Page Title" },
 *     { property: "og:description", content: "My page description" },
 *     { property: "og:image", content: "https://example.com/image.jpg" },
 *     { property: "og:url", content: "https://example.com" },
 *     { tagName: "link", rel: "icon", href: "/favicon.ico" },
 *     { tagName: "link", rel: "stylesheet", href: "/styles.css" },
 *     { tagName: "meta", name: "viewport", content: "width=device-width, initial-scale=1" },
 *   ]}
 * />
 * ```
 *
 * @param meta - An array of meta descriptors.
 * @returns A JSX element representing the meta tags.
 */
export function Meta(
  { meta = [] }: Readonly<{ meta?: MetaDescriptor[] }>,
): JSX.Element {
  return (
    <>
      {meta.map((metaProps) => {
        if (!metaProps) {
          return null;
        }

        if ("title" in metaProps) {
          return <title key="title">{String(metaProps.title)}</title>;
        }

        if ("charset" in metaProps) {
          metaProps.charSet ??= metaProps.charset;
          delete metaProps.charset;
        }

        if ("charSet" in metaProps && metaProps.charSet != null) {
          return typeof metaProps.charSet === "string"
            ? <meta key="charSet" charSet={metaProps.charSet} />
            : null;
        }

        if ("tagName" in metaProps) {
          const { tagName, ...rest } = metaProps;
          if (!isValidMetaTag(tagName)) {
            console.warn(
              `A meta object uses an invalid tagName: ${tagName}. Expected either 'link' or 'meta'`,
            );
            return null;
          }
          const Comp = tagName;
          return <Comp key={JSON.stringify(rest)} {...rest} />;
        }

        return <meta key={JSON.stringify(metaProps)} {...metaProps} />;
      })}
    </>
  );
}

function isValidMetaTag(tagName: unknown): tagName is "meta" | "link" {
  return typeof tagName === "string" && /^(meta|link)$/.test(tagName);
}
