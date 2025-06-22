import { Facet, RichText } from "@atproto/api";

type Props = Readonly<{
  text: string;
  facets?: Facet[];
}>;

export function RenderFacetedText({ text, facets }: Props) {
  const rt = new RichText({ text, facets });
  return (
    <>
      {[...rt.segments()].map((segment) => {
        const content = segment.text;

        if (segment.isMention()) {
          return (
            <a
              key={segment.mention?.did || segment.text}
              href={`/profile/${segment.mention?.did}`}
              class="text-sky-500 hover:underline"
            >
              {content}
            </a>
          );
        }

        if (segment.isLink()) {
          return (
            <a
              key={segment.link?.uri || segment.text}
              href={segment.link?.uri}
              class="text-sky-500 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {content}
            </a>
          );
        }

        if (segment.isTag() && segment.tag?.tag) {
          return (
            <a
              key={segment.tag.tag}
              href={`/hashtag/${segment.tag.tag}`}
              class="text-sky-500 hover:underline"
            >
              #{segment.tag.tag}
            </a>
          );
        }

        return <span key={segment.text}>{content}</span>;
      })}
    </>
  );
}
