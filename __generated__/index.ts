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
import * as SocialGrainNotificationGetNotifications from './types/social/grain/notification/getNotifications.ts'
import * as SocialGrainGalleryGetGalleryThread from './types/social/grain/gallery/getGalleryThread.ts'
import * as SocialGrainGalleryGetActorGalleries from './types/social/grain/gallery/getActorGalleries.ts'
import * as SocialGrainGalleryGetGallery from './types/social/grain/gallery/getGallery.ts'
import * as SocialGrainGraphGetFollowers from './types/social/grain/graph/getFollowers.ts'
import * as SocialGrainGraphGetFollows from './types/social/grain/graph/getFollows.ts'
import * as SocialGrainFeedGetTimeline from './types/social/grain/feed/getTimeline.ts'
import * as SocialGrainActorGetProfile from './types/social/grain/actor/getProfile.ts'
import * as SocialGrainActorSearchActors from './types/social/grain/actor/searchActors.ts'
import * as SocialGrainActorGetActorFavs from './types/social/grain/actor/getActorFavs.ts'
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
  gallery: SocialGrainGalleryNS
  graph: SocialGrainGraphNS
  labeler: SocialGrainLabelerNS
  feed: SocialGrainFeedNS
  actor: SocialGrainActorNS
  photo: SocialGrainPhotoNS

  constructor(server: Server) {
    this._server = server
    this.notification = new SocialGrainNotificationNS(server)
    this.gallery = new SocialGrainGalleryNS(server)
    this.graph = new SocialGrainGraphNS(server)
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

export class SocialGrainGalleryNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
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
}

export class SocialGrainPhotoNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
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
