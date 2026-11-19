import type { AtUriString } from "@atproto/lex";
import { query } from "$lib/xrpc";
import { createRecord } from "$lib/utils/records";
import type * as getCrossPost from "$lib/lexicons/social/grain/gallery/getCrossPost.ts";

/**
 * Shares the gallery or story `subject` on Bluesky: the post grain-serve
 * makes of it (`social.grain.gallery.getCrossPost`), written as it is to
 * the account's repo.
 */
export async function createBskyPost(subject: string): Promise<void> {
  const { post } = await query<typeof getCrossPost.main>("social.grain.gallery.getCrossPost", {
    subject: subject as AtUriString,
  });
  await createRecord({ collection: "app.bsky.feed.post", record: post as Record<string, unknown> });
}
