import { Record as BskyProfileRecord } from "$lexicon/types/app/bsky/actor/profile.ts";
import { ProfileView } from "$lexicon/types/dev/fly/bffbasic/defs.ts";
import { Record as ProfileRecord } from "$lexicon/types/dev/fly/bffbasic/profile.ts";
import { Un$Typed } from "$lexicon/util.ts";
import { BffContext, onSignedInArgs, WithBffMeta } from "@bigmoves/bff";

export async function onSignedIn({
  actor,
  ctx,
}: onSignedInArgs) {
  const profileResults = ctx.indexService.getRecords<ProfileRecord>(
    "dev.fly.bffbasic.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const profile = profileResults.items[0];

  if (profile) {
    console.log("Profile already exists");
    return `/profile/${actor.handle}`;
  }

  try {
    await ctx.backfillCollections({
      externalCollections: [
        "app.bsky.actor.profile",
      ],
      repos: [actor.did],
    });
  } catch (error) {
    console.error("Failed to backfill collections:", error);
    return;
  }

  const bskyProfileResults = ctx.indexService.getRecords<BskyProfileRecord>(
    "app.bsky.actor.profile",
    {
      where: [{ field: "did", equals: actor.did }],
    },
  );

  const bskyProfile = bskyProfileResults.items[0];

  if (!bskyProfile) {
    console.error("Failed to get profile");
    return;
  }

  await ctx.createRecord<ProfileRecord>(
    "dev.fly.bffbasic.profile",
    {
      displayName: bskyProfile.displayName ?? undefined,
      description: bskyProfile.description ?? undefined,
      avatar: bskyProfile.avatar ?? undefined,
      createdAt: new Date().toISOString(),
    },
    true,
  );

  return "/onboard";
}

export function getActorProfile(handle: string, ctx: BffContext) {
  const actor = ctx.indexService.getActorByHandle(handle);

  if (!actor) {
    console.error("Failed to get actor");
    return null;
  }

  const profileRecord = ctx.indexService.getRecord<WithBffMeta<ProfileRecord>>(
    `at://${actor.did}/dev.fly.bffbasic.profile/self`,
  );

  return profileRecord ? profileToView(profileRecord, actor.handle) : null;
}

export function profileStateResolver(_req: Request, ctx: BffContext) {
  if (ctx.currentUser) {
    const profile = getActorProfile(ctx.currentUser.handle, ctx);
    if (profile) {
      ctx.state.profile = profile;
      return ctx.next();
    }
  }
  return ctx.next();
}

export function profileToView(
  record: WithBffMeta<ProfileRecord>,
  handle: string,
): Un$Typed<ProfileView> {
  const avatar = record?.avatar
    ? `https://cdn.bsky.app/img/feed_thumbnail/plain/${record.did}/${record.avatar.ref.toString()}`
    : undefined;

  return {
    did: record.did,
    handle,
    displayName: record.displayName,
    description: record.description,
    avatar,
    createdAt: record.createdAt,
  };
}
