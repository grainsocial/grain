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
  gallery: SocialGrainGalleryNS
  graph: SocialGrainGraphNS
  actor: SocialGrainActorNS

  constructor(server: Server) {
    this._server = server
    this.gallery = new SocialGrainGalleryNS(server)
    this.graph = new SocialGrainGraphNS(server)
    this.actor = new SocialGrainActorNS(server)
  }
}

export class SocialGrainGalleryNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class SocialGrainGraphNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }
}

export class SocialGrainActorNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
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
