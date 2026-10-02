// Search-engine metadata: descriptions and schema.org structured data for the
// pages worth indexing. OGMeta renders what these return.

import type { GalleryView, GrainActorDefsProfileViewDetailed } from "$hatk/client";

type Label = { val: string; neg?: boolean };

/** Clip to a search snippet's length on a word boundary. */
export function snippet(text: string | null | undefined, max = 160): string | undefined {
  const flat = text?.replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/**
 * Whether labels keep a page out of search. Any active label does: a
 * moderation label means the content is hidden, blurred, or behind a warning
 * in the app, and a search result shows none of that. `!no-unauthenticated`
 * is the author asking not to be shown to logged-out viewers, which a crawler
 * is.
 */
export function labelsBlockIndexing(labels: Label[] | undefined): boolean {
  return !!labels?.some((l) => !l.neg);
}

/** Structured data wants absolute URLs; image views are relative in dev. */
function absolute(url: string, origin: string): string {
  return url.startsWith("http") ? url : `${origin}${url}`;
}

function personLd(
  p: {
    did: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
    description?: string;
  },
  origin: string,
  path: string,
) {
  return {
    "@type": "Person",
    name: p.displayName || p.handle || p.did,
    ...(p.handle ? { alternateName: `@${p.handle}` } : {}),
    identifier: p.did,
    url: `${origin}${path}`,
    ...(p.avatar ? { image: absolute(p.avatar, origin) } : {}),
    ...(p.description ? { description: p.description } : {}),
  };
}

/** https://developers.google.com/search/docs/appearance/structured-data/profile-page */
export function profileJsonLd(p: GrainActorDefsProfileViewDetailed, origin: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${origin}${path}`,
    ...(p.createdAt ? { dateCreated: p.createdAt } : {}),
    mainEntity: {
      ...personLd(p, origin, path),
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/FollowAction",
          userInteractionCount: p.followersCount ?? 0,
        },
      ],
      agentInteractionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WriteAction",
        userInteractionCount: p.galleryCount ?? 0,
      },
    },
  };
}

/**
 * A gallery as a social media posting, with each photo as an ImageObject that
 * carries its creator. Google reads the per-image creator and credit for image
 * search, and the posting type for the result itself.
 * https://developers.google.com/search/docs/appearance/structured-data/discussion-forum
 * https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata
 */
export function galleryJsonLd(g: GalleryView, origin: string, path: string, authorPath: string) {
  const author = personLd(g.creator, origin, authorPath);
  const credit = g.creator.handle ? `@${g.creator.handle}` : author.name;
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    url: `${origin}${path}`,
    headline: g.title,
    ...(g.description ? { text: g.description } : {}),
    ...(g.createdAt ? { datePublished: g.createdAt } : {}),
    ...(g.locationDisplay
      ? { contentLocation: { "@type": "Place", name: g.locationDisplay } }
      : {}),
    author,
    image: (g.items ?? []).map((photo) => ({
      "@type": "ImageObject",
      contentUrl: absolute(photo.fullsize, origin),
      thumbnailUrl: absolute(photo.thumb, origin),
      ...(photo.alt ? { caption: photo.alt } : {}),
      ...(photo.aspectRatio
        ? { width: photo.aspectRatio.width, height: photo.aspectRatio.height }
        : {}),
      creator: { "@type": "Person", name: author.name, url: author.url },
      creditText: credit,
      copyrightNotice: `© ${credit}`,
    })),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: g.favCount ?? 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: g.commentCount ?? 0,
      },
    ],
  };
}

/** The site itself, for the home page. */
export function siteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Grain",
        alternateName: "grain.social",
        url: `${origin}/`,
      },
      {
        "@type": "Organization",
        name: "Grain",
        url: `${origin}/`,
        logo: `${origin}/icon-512.png`,
        sameAs: [
          "https://bsky.app/profile/grain.social",
          "https://apps.apple.com/app/id6747730230",
          "https://play.google.com/store/apps/details?id=social.grain",
        ],
      },
    ],
  };
}
