// Reading a community's pool: the shared half of listPoolGalleries (one pool)
// and listPoolFeed (every pool the viewer is in).
//
// A pool is a permissioned space anchored on the community, holding one repo
// per member who has written into it. None of it is indexed — nothing in a
// space reaches a firehose — so a read means asking the space who has written,
// then reading those repos on the hosts that hold them, with a credential the
// community's host issues to the viewer. A viewer who is not a member never
// gets the credential, which is the whole access check.

import {
  blobCid,
  listSpaceRecords,
  listSpaceRepos,
  type PdsCall,
  poolUri,
  type SpaceRecord,
} from "../spaces/client.ts";

interface GalleryValue {
  title?: string;
  description?: string;
  createdAt?: string;
}
interface ItemValue {
  gallery?: string;
  item?: string;
  position?: number;
}
interface PhotoValue {
  photo?: unknown;
  alt?: string;
  aspectRatio?: { width: number; height: number };
}
interface FavoriteValue {
  subject?: string;
  createdAt?: string;
}
interface CommentValue {
  subject?: string;
  text?: string;
  facets?: unknown[];
  replyTo?: string;
  createdAt?: string;
}

export interface PoolPhoto {
  uri: string;
  did: string;
  cid: string;
  alt?: string;
  aspectRatio?: { width: number; height: number };
  position: number;
}

export interface PoolComment {
  /** `at://<author>/social.grain.comment/<rkey>` — the address the record would have. */
  uri: string;
  did: string;
  rkey: string;
  text: string;
  facets?: unknown[];
  replyTo?: string;
  createdAt?: string;
}

export interface PoolGallery {
  space: string;
  /** The community whose pool it is in. */
  group: string;
  /** Whose gallery it is. */
  did: string;
  rkey: string;
  /** `at://<author>/social.grain.gallery/<rkey>` — what a favourite or comment names. */
  uri: string;
  title: string;
  description?: string;
  createdAt?: string;
  photoCount: number;
  photos: PoolPhoto[];
  /** Favourites and comments from inside the pool — never the public ones. */
  favCount: number;
  /** The rkey of the viewer's own favourite, in their own repo, if they have one. */
  viewerFav?: string;
  commentCount: number;
  comments: PoolComment[];
}

/** An item names its gallery and its photo by the uri each would have in the author's public repo. */
const selfUri = (did: string, collection: string, rkey: string) =>
  `at://${did}/${collection}/${rkey}`;

/**
 * Every gallery in one community's pool, newest first.
 *
 * Throws whatever the space threw — a 401 from the authority is how "not a
 * member" arrives, and it is the caller's business whether that is an error
 * (one pool asked for by name) or a pool to skip (a feed across many).
 */
export async function readPool(
  pds: PdsCall,
  viewerDid: string,
  group: string,
): Promise<PoolGallery[]> {
  const space = poolUri(group);
  const repos = await listSpaceRepos(pds, viewerDid, space);
  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      // Five collections, because that is what a gallery in a pool is made of:
      // the gallery, its photos, the items joining them, and what other members
      // have said and starred about it. Every one of them is somebody's own
      // record in their own repo — a comment on your gallery is in the
      // commenter's repo, which is why this is a read per repo and not per
      // gallery.
      const [galleries, items, photos, favorites, comments] = await Promise.all([
        listSpaceRecords(pds, viewerDid, space, repo.did, "social.grain.gallery"),
        listSpaceRecords(pds, viewerDid, space, repo.did, "social.grain.gallery.item"),
        listSpaceRecords(pds, viewerDid, space, repo.did, "social.grain.photo"),
        listSpaceRecords(pds, viewerDid, space, repo.did, "social.grain.favorite"),
        listSpaceRecords(pds, viewerDid, space, repo.did, "social.grain.comment"),
      ]);
      return { did: repo.did, galleries, items, photos, favorites, comments };
    }),
  );

  // Favourites and comments are gathered across every repo first, then handed
  // to the gallery each one names.
  const favsFor = new Map<string, { did: string; rkey: string }[]>();
  const commentsFor = new Map<string, PoolComment[]>();
  for (const { did, favorites, comments } of perRepo) {
    for (const f of favorites) {
      const subject = (f.value as FavoriteValue).subject;
      if (!subject) continue;
      favsFor.set(subject, [...(favsFor.get(subject) ?? []), { did, rkey: f.rkey }]);
    }
    for (const c of comments) {
      const value = c.value as CommentValue;
      if (!value.subject || !value.text) continue;
      commentsFor.set(value.subject, [
        ...(commentsFor.get(value.subject) ?? []),
        {
          uri: selfUri(did, "social.grain.comment", c.rkey),
          did,
          rkey: c.rkey,
          text: value.text,
          ...(value.facets ? { facets: value.facets } : {}),
          ...(value.replyTo ? { replyTo: value.replyTo } : {}),
          ...(value.createdAt ? { createdAt: value.createdAt } : {}),
        },
      ]);
    }
  }

  const out = perRepo.flatMap(({ did, galleries, items, photos }) => {
    const byUri = new Map(
      photos.map((p: SpaceRecord) => [selfUri(did, "social.grain.photo", p.rkey), p]),
    );
    return galleries.map((g: SpaceRecord): PoolGallery => {
      const value = g.value as GalleryValue;
      const uri = selfUri(did, "social.grain.gallery", g.rkey);
      const mine = items
        .map((i: SpaceRecord) => i.value as ItemValue)
        .filter((i) => i.gallery === uri)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const gathered = mine.flatMap((i, index): PoolPhoto[] => {
        const photo = i.item ? byUri.get(i.item) : undefined;
        const photoValue = photo?.value as PhotoValue | undefined;
        const cid = blobCid(photoValue?.photo);
        // A photo whose record or blob is gone loses itself, not the gallery.
        if (!photo || !cid || !i.item) return [];
        return [
          {
            uri: i.item,
            did,
            cid,
            ...(photoValue?.alt ? { alt: photoValue.alt } : {}),
            ...(photoValue?.aspectRatio ? { aspectRatio: photoValue.aspectRatio } : {}),
            position: i.position ?? index,
          },
        ];
      });
      const favs = favsFor.get(uri) ?? [];
      const said = (commentsFor.get(uri) ?? []).sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      );
      const myFav = favs.find((f) => f.did === viewerDid);
      return {
        space,
        group,
        did,
        rkey: g.rkey,
        uri,
        title: value.title ?? "Untitled",
        ...(value.description ? { description: value.description } : {}),
        ...(value.createdAt ? { createdAt: value.createdAt } : {}),
        photoCount: gathered.length,
        photos: gathered,
        favCount: favs.length,
        ...(myFav ? { viewerFav: myFav.rkey } : {}),
        commentCount: said.length,
        comments: said,
      };
    });
  });

  out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return out;
}
