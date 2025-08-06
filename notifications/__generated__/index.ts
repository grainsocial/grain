/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
  type Options as XrpcOptions,
  type AuthVerifier,
  type StreamAuthVerifier,
} from "npm:@atproto/xrpc-server"
import { schemas } from './lexicons.ts'
import * as SocialGrainNotificationUpdateSeen from './types/social/grain/notification/updateSeen.ts'
import * as SocialGrainNotificationGetNotifications from './types/social/grain/notification/getNotifications.ts'
import * as SocialGrainCommentDeleteComment from './types/social/grain/comment/deleteComment.ts'
import * as SocialGrainCommentCreateComment from './types/social/grain/comment/createComment.ts'
import * as SocialGrainGalleryDeleteGallery from './types/social/grain/gallery/deleteGallery.ts'
import * as SocialGrainGalleryCreateItem from './types/social/grain/gallery/createItem.ts'
import * as SocialGrainGalleryCreateGallery from './types/social/grain/gallery/createGallery.ts'
import * as SocialGrainGalleryDeleteItem from './types/social/grain/gallery/deleteItem.ts'
import * as SocialGrainGalleryUpdateGallery from './types/social/grain/gallery/updateGallery.ts'
import * as SocialGrainGalleryApplySort from './types/social/grain/gallery/applySort.ts'
import * as SocialGrainGalleryGetGalleryThread from './types/social/grain/gallery/getGalleryThread.ts'
import * as SocialGrainGalleryGetActorGalleries from './types/social/grain/gallery/getActorGalleries.ts'
import * as SocialGrainGalleryGetGallery from './types/social/grain/gallery/getGallery.ts'
import * as SocialGrainGraphDeleteFollow from './types/social/grain/graph/deleteFollow.ts'
import * as SocialGrainGraphCreateFollow from './types/social/grain/graph/createFollow.ts'
import * as SocialGrainGraphGetFollowers from './types/social/grain/graph/getFollowers.ts'
import * as SocialGrainGraphGetFollows from './types/social/grain/graph/getFollows.ts'
import * as SocialGrainDarkroomGetGalleryComposite from './types/social/grain/darkroom/getGalleryComposite.ts'
import * as SocialGrainFavoriteDeleteFavorite from './types/social/grain/favorite/deleteFavorite.ts'
import * as SocialGrainFavoriteCreateFavorite from './types/social/grain/favorite/createFavorite.ts'
import * as SocialGrainFeedGetTimeline from './types/social/grain/feed/getTimeline.ts'
import * as SocialGrainActorGetProfile from './types/social/grain/actor/getProfile.ts'
import * as SocialGrainActorSearchActors from './types/social/grain/actor/searchActors.ts'
import * as SocialGrainActorUpdateAvatar from './types/social/grain/actor/updateAvatar.ts'
import * as SocialGrainActorGetActorFavs from './types/social/grain/actor/getActorFavs.ts'
import * as SocialGrainActorUpdateProfile from './types/social/grain/actor/updateProfile.ts'
import * as SocialGrainPhotoDeletePhoto from './types/social/grain/photo/deletePhoto.ts'
import * as SocialGrainPhotoUploadPhoto from './types/social/grain/photo/uploadPhoto.ts'
import * as SocialGrainPhotoCreateExif from './types/social/grain/photo/createExif.ts'
import * as SocialGrainPhotoApplyAlts from './types/social/grain/photo/applyAlts.ts'
import * as SocialGrainPhotoGetActorPhotos from './types/social/grain/photo/getActorPhotos.ts'

export const APP_BSKY_GRAPH = {
  DefsModlist: 'app.bsky.graph.defs#modlist',
  DefsCuratelist: 'app.bsky.graph.defs#curatelist',
  DefsReferencelist: 'app.bsky.graph.defs#referencelist',
}
export const APP_BSKY_FEED = {
  DefsRequestLess: 'app.bsky.feed.defs#requestLess',
  DefsRequestMore: 'app.bsky.feed.defs#requestMore',
  DefsInteractionLike: 'app.bsky.feed.defs#interactionLike',
  DefsInteractionSeen: 'app.bsky.feed.defs#interactionSeen',
  DefsClickthroughItem: 'app.bsky.feed.defs#clickthroughItem',
  DefsContentModeVideo: 'app.bsky.feed.defs#contentModeVideo',
  DefsInteractionQuote: 'app.bsky.feed.defs#interactionQuote',
  DefsInteractionReply: 'app.bsky.feed.defs#interactionReply',
  DefsInteractionShare: 'app.bsky.feed.defs#interactionShare',
  DefsClickthroughEmbed: 'app.bsky.feed.defs#clickthroughEmbed',
  DefsInteractionRepost: 'app.bsky.feed.defs#interactionRepost',
  DefsClickthroughAuthor: 'app.bsky.feed.defs#clickthroughAuthor',
  DefsClickthroughReposter: 'app.bsky.feed.defs#clickthroughReposter',
  DefsContentModeUnspecified: 'app.bsky.feed.defs#contentModeUnspecified',
}
export const COM_ATPROTO_MODERATION = {
  DefsReasonRude: 'com.atproto.moderation.defs#reasonRude',
  DefsReasonSpam: 'com.atproto.moderation.defs#reasonSpam',
  DefsReasonOther: 'com.atproto.moderation.defs#reasonOther',
  DefsReasonAppeal: 'com.atproto.moderation.defs#reasonAppeal',
  DefsReasonSexual: 'com.atproto.moderation.defs#reasonSexual',
  DefsReasonViolation: 'com.atproto.moderation.defs#reasonViolation',
  DefsReasonMisleading: 'com.atproto.moderation.defs#reasonMisleading',
}

export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer
  app: AppNS
  sh: ShNS
  social: SocialNS
  com: ComNS

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options)
    this.app = new AppNS(this)
    this.sh = new ShNS(this)
    this.social = new SocialNS(this)
    this.com = new ComNS(this)
  }
}

export class AppNS {
  _server: Server
  bsky: AppBskyNS

  constructor(server: Server) {
    this._server = server
    this.bsky = new AppBskyNS(server)
  }
}

export class AppBskyNS {
  _server: Server
  embed: AppBskyEmbedNS
  graph: AppBskyGraphNS
  feed: AppBskyFeedNS
  richtext: AppBskyRichtextNS
  actor: AppBskyActorNS

  constructor(server: Server) {
    this._server = server
    this.embed = new AppBskyEmbedNS(server)
    this.graph = new AppBskyGraphNS(server)
    this.feed = new AppBskyFeedNS(server)
    this.richtext = new AppBskyRichtextNS(server)
    this.actor = new AppBskyActorNS(server)
  }
}

export class AppBskyEmbedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyRichtextNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class AppBskyActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class ShNS {
  _server: Server
  tangled: ShTangledNS

  constructor(server: Server) {
    this._server = server
    this.tangled = new ShTangledNS(server)
  }
}

export class ShTangledNS {
  _server: Server
  graph: ShTangledGraphNS
  actor: ShTangledActorNS

  constructor(server: Server) {
    this._server = server
    this.graph = new ShTangledGraphNS(server)
    this.actor = new ShTangledActorNS(server)
  }
}

export class ShTangledGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class ShTangledActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class SocialNS {
  _server: Server
  grain: SocialGrainNS

  constructor(server: Server) {
    this._server = server
    this.grain = new SocialGrainNS(server)
  }
}

export class SocialGrainNS {
  _server: Server
  notification: SocialGrainNotificationNS
  comment: SocialGrainCommentNS
  gallery: SocialGrainGalleryNS
  graph: SocialGrainGraphNS
  darkroom: SocialGrainDarkroomNS
  favorite: SocialGrainFavoriteNS
  labeler: SocialGrainLabelerNS
  feed: SocialGrainFeedNS
  actor: SocialGrainActorNS
  photo: SocialGrainPhotoNS

  constructor(server: Server) {
    this._server = server
    this.notification = new SocialGrainNotificationNS(server)
    this.comment = new SocialGrainCommentNS(server)
    this.gallery = new SocialGrainGalleryNS(server)
    this.graph = new SocialGrainGraphNS(server)
    this.darkroom = new SocialGrainDarkroomNS(server)
    this.favorite = new SocialGrainFavoriteNS(server)
    this.labeler = new SocialGrainLabelerNS(server)
    this.feed = new SocialGrainFeedNS(server)
    this.actor = new SocialGrainActorNS(server)
    this.photo = new SocialGrainPhotoNS(server)
  }
}

export class SocialGrainNotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  updateSeen<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainNotificationUpdateSeen.Handler<ExtractAuth<AV>>,
      SocialGrainNotificationUpdateSeen.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getNotifications<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainNotificationGetNotifications.Handler<ExtractAuth<AV>>,
      SocialGrainNotificationGetNotifications.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.notification.getNotifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainCommentNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteComment<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainCommentDeleteComment.Handler<ExtractAuth<AV>>,
      SocialGrainCommentDeleteComment.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.comment.deleteComment' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createComment<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainCommentCreateComment.Handler<ExtractAuth<AV>>,
      SocialGrainCommentCreateComment.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.comment.createComment' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainGalleryNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteGallery<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryDeleteGallery.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryDeleteGallery.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.deleteGallery' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createItem<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryCreateItem.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryCreateItem.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.createItem' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createGallery<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryCreateGallery.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryCreateGallery.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.createGallery' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  deleteItem<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryDeleteItem.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryDeleteItem.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.deleteItem' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateGallery<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryUpdateGallery.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryUpdateGallery.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.updateGallery' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  applySort<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryApplySort.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryApplySort.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.applySort' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getGalleryThread<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryGetGalleryThread.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryGetGalleryThread.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.getGalleryThread' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorGalleries<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryGetActorGalleries.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryGetActorGalleries.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.getActorGalleries' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getGallery<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGalleryGetGallery.Handler<ExtractAuth<AV>>,
      SocialGrainGalleryGetGallery.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.gallery.getGallery' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteFollow<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGraphDeleteFollow.Handler<ExtractAuth<AV>>,
      SocialGrainGraphDeleteFollow.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.graph.deleteFollow' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createFollow<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGraphCreateFollow.Handler<ExtractAuth<AV>>,
      SocialGrainGraphCreateFollow.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.graph.createFollow' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollowers<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGraphGetFollowers.Handler<ExtractAuth<AV>>,
      SocialGrainGraphGetFollowers.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.graph.getFollowers' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getFollows<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainGraphGetFollows.Handler<ExtractAuth<AV>>,
      SocialGrainGraphGetFollows.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.graph.getFollows' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainDarkroomNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getGalleryComposite<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainDarkroomGetGalleryComposite.Handler<ExtractAuth<AV>>,
      SocialGrainDarkroomGetGalleryComposite.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.darkroom.getGalleryComposite' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainFavoriteNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deleteFavorite<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainFavoriteDeleteFavorite.Handler<ExtractAuth<AV>>,
      SocialGrainFavoriteDeleteFavorite.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.favorite.deleteFavorite' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createFavorite<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainFavoriteCreateFavorite.Handler<ExtractAuth<AV>>,
      SocialGrainFavoriteCreateFavorite.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.favorite.createFavorite' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainLabelerNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class SocialGrainFeedNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getTimeline<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainFeedGetTimeline.Handler<ExtractAuth<AV>>,
      SocialGrainFeedGetTimeline.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.feed.getTimeline' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainActorGetProfile.Handler<ExtractAuth<AV>>,
      SocialGrainActorGetProfile.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.actor.getProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  searchActors<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainActorSearchActors.Handler<ExtractAuth<AV>>,
      SocialGrainActorSearchActors.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.actor.searchActors' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateAvatar<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainActorUpdateAvatar.Handler<ExtractAuth<AV>>,
      SocialGrainActorUpdateAvatar.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.actor.updateAvatar' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorFavs<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainActorGetActorFavs.Handler<ExtractAuth<AV>>,
      SocialGrainActorGetActorFavs.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.actor.getActorFavs' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateProfile<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainActorUpdateProfile.Handler<ExtractAuth<AV>>,
      SocialGrainActorUpdateProfile.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.actor.updateProfile' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class SocialGrainPhotoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  deletePhoto<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainPhotoDeletePhoto.Handler<ExtractAuth<AV>>,
      SocialGrainPhotoDeletePhoto.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.photo.deletePhoto' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  uploadPhoto<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainPhotoUploadPhoto.Handler<ExtractAuth<AV>>,
      SocialGrainPhotoUploadPhoto.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.photo.uploadPhoto' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  createExif<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainPhotoCreateExif.Handler<ExtractAuth<AV>>,
      SocialGrainPhotoCreateExif.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.photo.createExif' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  applyAlts<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainPhotoApplyAlts.Handler<ExtractAuth<AV>>,
      SocialGrainPhotoApplyAlts.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.photo.applyAlts' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getActorPhotos<AV extends AuthVerifier>(
    cfg: ConfigOf<
      AV,
      SocialGrainPhotoGetActorPhotos.Handler<ExtractAuth<AV>>,
      SocialGrainPhotoGetActorPhotos.HandlerReqCtx<ExtractAuth<AV>>
    >,
  ) {
    const nsid = 'social.grain.photo.getActorPhotos' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}

export class ComNS {
  _server: Server
  atproto: ComAtprotoNS

  constructor(server: Server) {
    this._server = server
    this.atproto = new ComAtprotoNS(server)
  }
}

export class ComAtprotoNS {
  _server: Server
  repo: ComAtprotoRepoNS

  constructor(server: Server) {
    this._server = server
    this.repo = new ComAtprotoRepoNS(server)
  }
}

export class ComAtprotoRepoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

type SharedRateLimitOpts<T> = {
  name: string
  calcKey?: (ctx: T) => string | null
  calcPoints?: (ctx: T) => number
}
type RouteRateLimitOpts<T> = {
  durationMs: number
  points: number
  calcKey?: (ctx: T) => string | null
  calcPoints?: (ctx: T) => number
}
type HandlerOpts = { blobLimit?: number }
type HandlerRateLimitOpts<T> = SharedRateLimitOpts<T> | RouteRateLimitOpts<T>
type ConfigOf<Auth, Handler, ReqCtx> =
  | Handler
  | {
      auth?: Auth
      opts?: HandlerOpts
      rateLimit?: HandlerRateLimitOpts<ReqCtx> | HandlerRateLimitOpts<ReqCtx>[]
      handler: Handler
    }
type ExtractAuth<AV extends AuthVerifier | StreamAuthVerifier> = Extract<
  Awaited<ReturnType<AV>>,
  { credentials: unknown }
>
