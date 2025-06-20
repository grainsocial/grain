import { ProfileView } from "$lexicon/types/social/grain/actor/defs.ts";
import { Record as Comment } from "$lexicon/types/social/grain/comment.ts";
import { CommentView } from "$lexicon/types/social/grain/comment/defs.ts";
import { Record as Gallery } from "$lexicon/types/social/grain/gallery.ts";
import {
  GalleryView,
  isGalleryView,
} from "$lexicon/types/social/grain/gallery/defs.ts";
import {
  isPhotoView,
  PhotoView,
} from "$lexicon/types/social/grain/photo/defs.ts";
import { AtUri } from "@atproto/syntax";
import { BffContext, BffMiddleware, route, WithBffMeta } from "@bigmoves/bff";
import { cn } from "@bigmoves/bff/components";
import { Dialog } from "..//components/Dialog.tsx";
import { ActorAvatar } from "../components/ActorAvatar.tsx";
import { ActorInfo } from "../components/ActorInfo.tsx";
import { Button } from "../components/Button.tsx";
import { GalleryPreviewLink } from "../components/GalleryPreviewLink.tsx";
import { Textarea } from "../components/Textarea.tsx";
import { getActorProfile, getActorProfilesBulk } from "../lib/actor.ts";
import { getGalleriesBulk, getGallery } from "../lib/gallery.ts";
import { getPhoto, getPhotosBulk } from "../lib/photo.ts";
import { formatRelativeTime } from "../utils.ts";

export function ReplyDialog({ userProfile, gallery, photo, comment }: Readonly<{
  userProfile: ProfileView;
  gallery?: GalleryView;
  photo?: PhotoView;
  comment?: CommentView;
}>) {
  const galleryRkey = gallery ? new AtUri(gallery.uri).rkey : undefined;
  const profile = gallery?.creator;
  return (
    <Dialog class="z-101">
      <Dialog.Content class="gap-4">
        <Dialog.Title>Add a comment</Dialog.Title>
        <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        <div class="divide-y divide-zinc-200 dark:divide-zinc-800 space-y-4">
          <div class="flex gap-4 pb-4">
            {!comment && profile
              ? <ActorAvatar profile={profile} size={42} />
              : null}
            {comment
              ? <ActorAvatar profile={comment.author} size={42} />
              : null}
            <div class="flex flex-col gap-2">
              {profile
                ? <div class="font-semibold">{profile.displayName}</div>
                : null}
              {comment && comment.text}
              {!comment && !photo && gallery &&
                (gallery.record as Gallery).title}
              {!comment && !photo && gallery
                ? (
                  <div class="w-[200px] pointer-events-none">
                    <GalleryPreviewLink
                      gallery={gallery}
                      size="small"
                    />
                  </div>
                )
                : null}
              {photo
                ? (
                  <div class="w-[200px] pointer-events-none">
                    <img src={photo.thumb} alt={photo.alt} class="rounded-md" />
                  </div>
                )
                : null}
            </div>
          </div>
          <form
            id="reply-form"
            class="flex gap-4"
            hx-post={`/actions/comments/${gallery?.creator.did}/gallery/${galleryRkey}`}
            hx-target="#dialog-target"
            hx-swap="innerHTML"
            _="on htmx:afterOnLoad
            if event.detail.xhr.status != 200
              alert('Error: ' + event.detail.xhr.responseText)"
          >
            <ActorAvatar profile={userProfile} size={42} />
            {!comment && photo
              ? <input type="hidden" name="focus" value={photo.uri} />
              : null}
            {comment
              ? <input type="hidden" name="replyTo" value={comment.uri} />
              : null}
            <Textarea
              class="flex-1"
              name="text"
              placeholder="Add a comment"
              rows={5}
              autoFocus
            />
          </form>
        </div>
        <div class="flex flex-col gap-2">
          <Button type="submit" form="reply-form" variant="primary">
            Reply
          </Button>
          <Dialog.Close variant="secondary">Cancel</Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

export function GalleryCommentsDialog(
  { userProfile, comments, gallery }: Readonly<{
    userProfile: ProfileView;
    comments: CommentView[];
    gallery: GalleryView;
  }>,
) {
  const { topLevel, repliesByParent } = groupComments(comments);
  return (
    <Dialog>
      <Dialog.Content class="flex flex-col max-h-[90vh] overflow-hidden">
        <div>
          <Dialog.Title>Comments</Dialog.Title>
          <Dialog.X class="fill-zinc-950 dark:fill-zinc-50" />
        </div>
        <div>
          <div class="flex gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            {gallery.creator
              ? <ActorAvatar profile={gallery.creator} size={42} />
              : null}
            <div class="flex flex-col gap-2">
              {gallery.creator
                ? <div class="font-semibold">{gallery.creator.displayName}</div>
                : null}
              {(gallery.record as Gallery).title}
              <div class="w-[200px] pointer-events-none">
                <GalleryPreviewLink
                  gallery={gallery}
                  size="small"
                />
              </div>
            </div>
          </div>
          <div class="py-1 border-b border-zinc-200 dark:border-zinc-800">
            {gallery
              ? (
                <ReplyButton
                  class="w-full bg-zinc-100 dark:bg-zinc-800 sm:bg-transparent dark:sm:bg-transparent sm:hover:bg-zinc-100 dark:sm:hover:bg-zinc-800"
                  userProfile={userProfile}
                  gallery={gallery}
                />
              )
              : null}
          </div>
        </div>
        {topLevel && topLevel.length > 0
          ? (
            <div class="flex-1 flex flex-col py-4 gap-6 overflow-y-scroll grain-scroll-area">
              {topLevel.map((comment) => (
                <div key={comment.cid} class="flex flex-col gap-4">
                  <CommentBlock comment={comment} />

                  {repliesByParent.get(comment.uri)?.map((reply) => (
                    <div key={reply.cid} class="ml-6">
                      <CommentBlock comment={reply} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
          : <div class="py-4">No comments yet.</div>}
        <div class="pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Dialog.Close
            variant="secondary"
            class="w-full"
          >
            Close
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog>
  );
}

function CommentBlock({ comment }: Readonly<{ comment: CommentView }>) {
  const gallery = isGalleryView(comment.subject) ? comment.subject : undefined;
  const rkey = gallery ? new AtUri(gallery.uri).rkey : undefined;
  return (
    <div class="flex gap-3 items-start">
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex items-center gap-2 min-w-0 text-sm text-zinc-500">
          <ActorInfo profile={comment.author} avatarSize={22} />
          <span class="shrink-0">·</span>
          <span class="shrink-0">
            {comment.createdAt
              ? formatRelativeTime(new Date(comment.createdAt))
              : ""}
          </span>
        </div>

        <div class="mt-1">{comment.text}</div>

        {isPhotoView(comment.focus) && (
          <img
            src={comment.focus.thumb}
            alt={comment.focus.alt}
            class="mt-2 rounded-md max-w-[200px] max-h-[150px] object-contain w-fit"
          />
        )}

        {!comment.replyTo
          ? (
            <button
              type="button"
              class="w-fit p-0 mt-2 cursor-pointer text-zinc-600 dark:text-zinc-500 font-semibold text-sm"
              hx-get={`/ui/comments/${gallery?.creator.did}/gallery/${rkey}/reply?comment=${
                encodeURIComponent(comment.uri)
              }`}
              hx-trigger="click"
              hx-target="#dialog-target"
              hx-swap="innerHTML"
            >
              Reply
            </button>
          )
          : null}
      </div>
    </div>
  );
}

export function CommentsButton(
  { class: classProp, variant, gallery }: Readonly<{
    class?: string;
    variant: "button" | "icon-button";
    gallery: GalleryView;
  }>,
) {
  const variantClass = variant === "icon-button"
    ? "flex w-fit items-center gap-2 m-0 p-0 mt-2"
    : undefined;
  const rkey = new AtUri(gallery.uri).rkey;
  return (
    <Button
      type="button"
      variant={variant === "icon-button" ? "ghost" : "secondary"}
      class={cn("whitespace-nowrap", variantClass, classProp)}
      hx-get={`/ui/comments/${gallery.creator.did}/gallery/${rkey}`}
      hx-trigger="click"
      hx-target="#dialog-target"
      hx-swap="innerHTML"
    >
      <i class="fa-regular fa-comment" /> {gallery.commentCount ?? 0}
    </Button>
  );
}

export function ReplyButton(
  { class: classProp, userProfile, gallery, photo }: Readonly<{
    class?: string;
    userProfile: ProfileView;
    gallery: GalleryView;
    photo?: PhotoView;
  }>,
) {
  const rkey = new AtUri(gallery.uri).rkey;
  return (
    <button
      type="button"
      class={cn(
        "flex items-center gap-4 p-3 rounded-full cursor-pointer",
        classProp,
      )}
      hx-get={`/ui/comments/${gallery.creator.did}/gallery/${rkey}/reply${
        photo ? `?photo=${encodeURIComponent(photo.uri)}` : ""
      }`}
      hx-trigger="click"
      hx-target="#dialog-target"
      hx-swap="innerHTML"
      _="on click halt"
    >
      <ActorAvatar profile={userProfile} size={22} />
      Add a comment
    </button>
  );
}

export const middlewares: BffMiddleware[] = [
  // Actions
  route(
    "/actions/comments/:creatorDid/gallery/:rkey",
    ["POST"],
    async (req, params, ctx) => {
      const { did } = ctx.requireAuth();
      const profile = getActorProfile(did, ctx);
      if (!profile) return ctx.next();

      const creatorDid = params.creatorDid;
      const rkey = params.rkey;

      const gallery = getGallery(creatorDid, rkey, ctx);
      if (!gallery) return ctx.next();

      const form = await req.formData();
      const text = form.get("text") as string;
      const focus = form.get("focus") as string;
      const replyTo = form.get("replyTo") as string;

      if (typeof text !== "string" || text.length === 0) {
        return new Response("Text is required", { status: 400 });
      }

      try {
        await ctx.createRecord<WithBffMeta<Comment>>(
          "social.grain.comment",
          {
            text,
            subject: gallery.uri,
            focus: focus ?? undefined,
            replyTo: replyTo ?? undefined,
            createdAt: new Date().toISOString(),
          },
        );
      } catch (error) {
        console.error("Error creating comment:", error);
      }

      const comments = getGalleryComments(gallery.uri, ctx);

      return ctx.html(
        <GalleryCommentsDialog
          userProfile={profile}
          comments={comments}
          gallery={gallery}
        />,
      );
    },
  ),

  // UI
  route(
    "/ui/comments/:creatorDid/gallery/:rkey",
    (_req, params, ctx) => {
      const { did } = ctx.requireAuth();
      const profile = getActorProfile(did, ctx);
      if (!profile) return ctx.next();
      const creatorDid = params.creatorDid;
      const rkey = params.rkey;
      const gallery = getGallery(creatorDid, rkey, ctx);
      if (!gallery) return ctx.next();
      const comments = getGalleryComments(gallery.uri, ctx);
      return ctx.html(
        <GalleryCommentsDialog
          userProfile={profile}
          comments={comments}
          gallery={gallery}
        />,
      );
    },
  ),
  route(
    "/ui/comments/:creatorDid/gallery/:rkey/reply",
    (req, params, ctx) => {
      const { did } = ctx.requireAuth();
      const profile = getActorProfile(did, ctx);
      if (!profile) return ctx.next();
      const url = new URL(req.url);
      const photoUri = url.searchParams.get("photo");
      const commentUri = url.searchParams.get("comment");
      if (commentUri) {
        const comment = getComment(commentUri, ctx);
        if (comment) {
          const gallery = isGalleryView(comment.subject)
            ? comment.subject
            : undefined;
          const photo = isPhotoView(comment.focus) ? comment.focus : undefined;
          return ctx.html(
            <ReplyDialog
              userProfile={profile}
              comment={comment}
              gallery={gallery}
              photo={photo}
            />,
          );
        }
      }
      const creatorDid = params.creatorDid;
      const rkey = params.rkey;
      let photo: PhotoView | undefined;
      if (photoUri) {
        const p = getPhoto(photoUri, ctx);
        photo = p ?? undefined;
      }
      const gallery = getGallery(creatorDid, rkey, ctx);
      if (!gallery) return ctx.next();
      return ctx.html(
        <ReplyDialog userProfile={profile} photo={photo} gallery={gallery} />,
      );
    },
  ),
];

function groupComments(comments: CommentView[]) {
  const repliesByParent = new Map<string, CommentView[]>();
  const topLevel: CommentView[] = [];

  for (const comment of comments) {
    if (comment.replyTo) {
      if (!repliesByParent.has(comment.replyTo)) {
        repliesByParent.set(comment.replyTo, []);
      }
      repliesByParent.get(comment.replyTo)!.push(comment);
    } else {
      topLevel.push(comment);
    }
  }

  return { topLevel, repliesByParent };
}

export function getGalleryCommentsCount(uri: string, ctx: BffContext): number {
  return ctx.indexService.countRecords(
    "social.grain.comment",
    {
      where: {
        "AND": [{ field: "subject", equals: uri }],
      },
      limit: 0,
    },
  );
}

function getGalleryComments(uri: string, ctx: BffContext): CommentView[] {
  const { items: comments } = ctx.indexService.getRecords<WithBffMeta<Comment>>(
    "social.grain.comment",
    {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      where: {
        "AND": [{ field: "subject", equals: uri }],
      },
      limit: 100,
    },
  );

  // Batch fetch all authors, subjects, and focus photos for comments using bulk functions
  const authorDids = Array.from(new Set(comments.map((c) => c.did)));
  const subjectUris = Array.from(new Set(comments.map((c) => c.subject)));
  const focusUris: string[] = Array.from(
    new Set(
      comments.map((c) => typeof c.focus === "string" ? c.focus : undefined)
        .filter((uri): uri is string => !!uri),
    ),
  );

  const authorProfiles = getActorProfilesBulk(authorDids, ctx);
  const authorMap = new Map(authorProfiles.map((p) => [p.did, p]));
  const subjectViews = getGalleriesBulk(subjectUris, ctx);
  const subjectMap = new Map(subjectViews.map((g) => [g.uri, g]));
  const focusViews = getPhotosBulk(focusUris, ctx);
  const focusMap = new Map(focusViews.map((p) => [p.uri, p]));

  return comments.reduce<CommentView[]>((acc, comment) => {
    const author = authorMap.get(comment.did);
    if (!author) return acc;
    const subject = subjectMap.get(comment.subject);
    if (!subject) return acc;
    let focus: PhotoView | undefined = undefined;
    if (comment.focus) {
      focus = focusMap.get(comment.focus);
    }
    acc.push(commentToView(comment, author, subject, focus));
    return acc;
  }, []);
}

function getComment(uri: string, ctx: BffContext) {
  const { items: comments } = ctx.indexService.getRecords<WithBffMeta<Comment>>(
    "social.grain.comment",
    {
      where: [{ field: "uri", equals: uri }],
    },
  );
  if (comments.length === 0) return undefined;
  const comment = comments[0];
  const author = getActorProfile(comment.did, ctx);
  if (!author) return undefined;
  const subjectDid = new AtUri(comment.subject).hostname;
  const subjectRkey = new AtUri(comment.subject).rkey;
  const subject = getGallery(subjectDid, subjectRkey, ctx);
  if (!subject) return undefined;
  let focus: PhotoView | undefined = undefined;
  if (comment.focus) {
    focus = getPhoto(comment.focus, ctx) ?? undefined;
  }
  return commentToView(comment, author, subject, focus);
}

function commentToView(
  record: WithBffMeta<Comment>,
  author: ProfileView,
  subject?: GalleryView,
  focus?: PhotoView,
): CommentView {
  return {
    uri: record.uri,
    cid: record.cid,
    text: record.text,
    subject: isGalleryView(subject) ? subject : undefined,
    focus: isPhotoView(focus) ? focus : undefined,
    replyTo: record.replyTo,
    author,
    createdAt: record.createdAt,
  };
}
