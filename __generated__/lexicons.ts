/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from "npm:@atproto/lexicon"
import { type $Typed, is$typed, maybe$typed } from './util.ts'

export const schemaDict = {
  AppBskyEmbedDefs: {
    lexicon: 1,
    id: 'app.bsky.embed.defs',
    defs: {
      aspectRatio: {
        type: 'object',
        required: ['width', 'height'],
        properties: {
          width: {
            type: 'integer',
            minimum: 1,
          },
          height: {
            type: 'integer',
            minimum: 1,
          },
        },
        description:
          'width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit.',
      },
    },
  },
  AppBskyEmbedRecord: {
    lexicon: 1,
    id: 'app.bsky.embed.record',
    description:
      'A representation of a record embedded in a Bluesky record (eg, a post). For example, a quote-post, or sharing a feed generator record.',
    defs: {
      main: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            ref: 'lex:com.atproto.repo.strongRef',
            type: 'ref',
          },
        },
      },
      view: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            refs: [
              'lex:app.bsky.embed.record#viewRecord',
              'lex:app.bsky.embed.record#viewNotFound',
              'lex:app.bsky.embed.record#viewBlocked',
              'lex:app.bsky.embed.record#viewDetached',
              'lex:app.bsky.feed.defs#generatorView',
              'lex:app.bsky.graph.defs#listView',
              'lex:app.bsky.labeler.defs#labelerView',
              'lex:app.bsky.graph.defs#starterPackViewBasic',
            ],
            type: 'union',
          },
        },
      },
      viewRecord: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'value', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          value: {
            type: 'unknown',
            description: 'The record data itself.',
          },
          author: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
          },
          embeds: {
            type: 'array',
            items: {
              refs: [
                'lex:app.bsky.embed.images#view',
                'lex:app.bsky.embed.video#view',
                'lex:app.bsky.embed.external#view',
                'lex:app.bsky.embed.record#view',
                'lex:app.bsky.embed.recordWithMedia#view',
              ],
              type: 'union',
            },
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          likeCount: {
            type: 'integer',
          },
          quoteCount: {
            type: 'integer',
          },
          replyCount: {
            type: 'integer',
          },
          repostCount: {
            type: 'integer',
          },
        },
      },
      viewBlocked: {
        type: 'object',
        required: ['uri', 'blocked', 'author'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          author: {
            ref: 'lex:app.bsky.feed.defs#blockedAuthor',
            type: 'ref',
          },
          blocked: {
            type: 'boolean',
            const: true,
          },
        },
      },
      viewDetached: {
        type: 'object',
        required: ['uri', 'detached'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          detached: {
            type: 'boolean',
            const: true,
          },
        },
      },
      viewNotFound: {
        type: 'object',
        required: ['uri', 'notFound'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          notFound: {
            type: 'boolean',
            const: true,
          },
        },
      },
    },
  },
  AppBskyEmbedImages: {
    lexicon: 1,
    id: 'app.bsky.embed.images',
    description: 'A set of images embedded in a Bluesky record (eg, a post).',
    defs: {
      main: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.embed.images#image',
              type: 'ref',
            },
            maxLength: 4,
          },
        },
      },
      view: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.embed.images#viewImage',
              type: 'ref',
            },
            maxLength: 4,
          },
        },
      },
      image: {
        type: 'object',
        required: ['image', 'alt'],
        properties: {
          alt: {
            type: 'string',
            description:
              'Alt text description of the image, for accessibility.',
          },
          image: {
            type: 'blob',
            accept: ['image/*'],
            maxSize: 1000000,
          },
          aspectRatio: {
            ref: 'lex:app.bsky.embed.defs#aspectRatio',
            type: 'ref',
          },
        },
      },
      viewImage: {
        type: 'object',
        required: ['thumb', 'fullsize', 'alt'],
        properties: {
          alt: {
            type: 'string',
            description:
              'Alt text description of the image, for accessibility.',
          },
          thumb: {
            type: 'string',
            format: 'uri',
            description:
              'Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View.',
          },
          fullsize: {
            type: 'string',
            format: 'uri',
            description:
              'Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View.',
          },
          aspectRatio: {
            ref: 'lex:app.bsky.embed.defs#aspectRatio',
            type: 'ref',
          },
        },
      },
    },
  },
  AppBskyEmbedRecordWithMedia: {
    lexicon: 1,
    id: 'app.bsky.embed.recordWithMedia',
    description:
      'A representation of a record embedded in a Bluesky record (eg, a post), alongside other compatible embeds. For example, a quote post and image, or a quote post and external URL card.',
    defs: {
      main: {
        type: 'object',
        required: ['record', 'media'],
        properties: {
          media: {
            refs: [
              'lex:app.bsky.embed.images',
              'lex:app.bsky.embed.video',
              'lex:app.bsky.embed.external',
            ],
            type: 'union',
          },
          record: {
            ref: 'lex:app.bsky.embed.record',
            type: 'ref',
          },
        },
      },
      view: {
        type: 'object',
        required: ['record', 'media'],
        properties: {
          media: {
            refs: [
              'lex:app.bsky.embed.images#view',
              'lex:app.bsky.embed.video#view',
              'lex:app.bsky.embed.external#view',
            ],
            type: 'union',
          },
          record: {
            ref: 'lex:app.bsky.embed.record#view',
            type: 'ref',
          },
        },
      },
    },
  },
  AppBskyEmbedVideo: {
    lexicon: 1,
    id: 'app.bsky.embed.video',
    description: 'A video embedded in a Bluesky record (eg, a post).',
    defs: {
      main: {
        type: 'object',
        required: ['video'],
        properties: {
          alt: {
            type: 'string',
            maxLength: 10000,
            description:
              'Alt text description of the video, for accessibility.',
            maxGraphemes: 1000,
          },
          video: {
            type: 'blob',
            accept: ['video/mp4'],
            maxSize: 50000000,
          },
          captions: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.embed.video#caption',
              type: 'ref',
            },
            maxLength: 20,
          },
          aspectRatio: {
            ref: 'lex:app.bsky.embed.defs#aspectRatio',
            type: 'ref',
          },
        },
      },
      view: {
        type: 'object',
        required: ['cid', 'playlist'],
        properties: {
          alt: {
            type: 'string',
            maxLength: 10000,
            maxGraphemes: 1000,
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          playlist: {
            type: 'string',
            format: 'uri',
          },
          thumbnail: {
            type: 'string',
            format: 'uri',
          },
          aspectRatio: {
            ref: 'lex:app.bsky.embed.defs#aspectRatio',
            type: 'ref',
          },
        },
      },
      caption: {
        type: 'object',
        required: ['lang', 'file'],
        properties: {
          file: {
            type: 'blob',
            accept: ['text/vtt'],
            maxSize: 20000,
          },
          lang: {
            type: 'string',
            format: 'language',
          },
        },
      },
    },
  },
  AppBskyEmbedExternal: {
    lexicon: 1,
    id: 'app.bsky.embed.external',
    defs: {
      main: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            ref: 'lex:app.bsky.embed.external#external',
            type: 'ref',
          },
        },
        description:
          "A representation of some externally linked content (eg, a URL and 'card'), embedded in a Bluesky record (eg, a post).",
      },
      view: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            ref: 'lex:app.bsky.embed.external#viewExternal',
            type: 'ref',
          },
        },
      },
      external: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          thumb: {
            type: 'blob',
            accept: ['image/*'],
            maxSize: 1000000,
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
        },
      },
      viewExternal: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          thumb: {
            type: 'string',
            format: 'uri',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyGraphFollow: {
    lexicon: 1,
    id: 'app.bsky.graph.follow',
    defs: {
      main: {
        key: 'tid',
        type: 'record',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
        description:
          "Record declaring a social 'follow' relationship of another account. Duplicate follows will be ignored by the AppView.",
      },
    },
  },
  AppBskyGraphDefs: {
    lexicon: 1,
    id: 'app.bsky.graph.defs',
    defs: {
      modlist: {
        type: 'token',
        description:
          'A list of actors to apply an aggregate moderation action (mute/block) on.',
      },
      listView: {
        type: 'object',
        required: ['uri', 'cid', 'creator', 'name', 'purpose', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          name: {
            type: 'string',
            maxLength: 64,
            minLength: 1,
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.graph.defs#listViewerState',
            type: 'ref',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileView',
            type: 'ref',
          },
          purpose: {
            ref: 'lex:app.bsky.graph.defs#listPurpose',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          description: {
            type: 'string',
            maxLength: 3000,
            maxGraphemes: 300,
          },
          listItemCount: {
            type: 'integer',
            minimum: 0,
          },
          descriptionFacets: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.richtext.facet',
              type: 'ref',
            },
          },
        },
      },
      curatelist: {
        type: 'token',
        description:
          'A list of actors used for curation purposes such as list feeds or interaction gating.',
      },
      listPurpose: {
        type: 'string',
        knownValues: [
          'app.bsky.graph.defs#modlist',
          'app.bsky.graph.defs#curatelist',
          'app.bsky.graph.defs#referencelist',
        ],
      },
      listItemView: {
        type: 'object',
        required: ['uri', 'subject'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          subject: {
            ref: 'lex:app.bsky.actor.defs#profileView',
            type: 'ref',
          },
        },
      },
      relationship: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          following: {
            type: 'string',
            format: 'at-uri',
            description:
              'if the actor follows this DID, this is the AT-URI of the follow record',
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
            description:
              'if the actor is followed by this DID, contains the AT-URI of the follow record',
          },
        },
        description:
          'lists the bi-directional graph relationships between one actor (not indicated in the object), and the target actors (the DID included in the object)',
      },
      listViewBasic: {
        type: 'object',
        required: ['uri', 'cid', 'name', 'purpose'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          name: {
            type: 'string',
            maxLength: 64,
            minLength: 1,
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.graph.defs#listViewerState',
            type: 'ref',
          },
          purpose: {
            ref: 'lex:app.bsky.graph.defs#listPurpose',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          listItemCount: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      notFoundActor: {
        type: 'object',
        required: ['actor', 'notFound'],
        properties: {
          actor: {
            type: 'string',
            format: 'at-identifier',
          },
          notFound: {
            type: 'boolean',
            const: true,
          },
        },
        description: 'indicates that a handle or DID could not be resolved',
      },
      referencelist: {
        type: 'token',
        description:
          'A list of actors used for only for reference purposes such as within a starter pack.',
      },
      listViewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
          blocked: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      starterPackView: {
        type: 'object',
        required: ['uri', 'cid', 'record', 'creator', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          list: {
            ref: 'lex:app.bsky.graph.defs#listViewBasic',
            type: 'ref',
          },
          feeds: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.feed.defs#generatorView',
              type: 'ref',
            },
            maxLength: 3,
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          record: {
            type: 'unknown',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          joinedWeekCount: {
            type: 'integer',
            minimum: 0,
          },
          listItemsSample: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.graph.defs#listItemView',
              type: 'ref',
            },
            maxLength: 12,
          },
          joinedAllTimeCount: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      starterPackViewBasic: {
        type: 'object',
        required: ['uri', 'cid', 'record', 'creator', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          record: {
            type: 'unknown',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          listItemCount: {
            type: 'integer',
            minimum: 0,
          },
          joinedWeekCount: {
            type: 'integer',
            minimum: 0,
          },
          joinedAllTimeCount: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
  AppBskyFeedDefs: {
    lexicon: 1,
    id: 'app.bsky.feed.defs',
    defs: {
      postView: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'record', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          embed: {
            refs: [
              'lex:app.bsky.embed.images#view',
              'lex:app.bsky.embed.video#view',
              'lex:app.bsky.embed.external#view',
              'lex:app.bsky.embed.record#view',
              'lex:app.bsky.embed.recordWithMedia#view',
            ],
            type: 'union',
          },
          author: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          record: {
            type: 'unknown',
          },
          viewer: {
            ref: 'lex:app.bsky.feed.defs#viewerState',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          likeCount: {
            type: 'integer',
          },
          quoteCount: {
            type: 'integer',
          },
          replyCount: {
            type: 'integer',
          },
          threadgate: {
            ref: 'lex:app.bsky.feed.defs#threadgateView',
            type: 'ref',
          },
          repostCount: {
            type: 'integer',
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            refs: [
              'lex:app.bsky.feed.defs#postView',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
            type: 'union',
          },
          parent: {
            refs: [
              'lex:app.bsky.feed.defs#postView',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
            type: 'union',
          },
          grandparentAuthor: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
            description:
              'When parent is a reply to another post, this is the author of that post.',
          },
        },
      },
      reasonPin: {
        type: 'object',
        properties: {},
      },
      blockedPost: {
        type: 'object',
        required: ['uri', 'blocked', 'author'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          author: {
            ref: 'lex:app.bsky.feed.defs#blockedAuthor',
            type: 'ref',
          },
          blocked: {
            type: 'boolean',
            const: true,
          },
        },
      },
      interaction: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            format: 'at-uri',
          },
          event: {
            type: 'string',
            knownValues: [
              'app.bsky.feed.defs#requestLess',
              'app.bsky.feed.defs#requestMore',
              'app.bsky.feed.defs#clickthroughItem',
              'app.bsky.feed.defs#clickthroughAuthor',
              'app.bsky.feed.defs#clickthroughReposter',
              'app.bsky.feed.defs#clickthroughEmbed',
              'app.bsky.feed.defs#interactionSeen',
              'app.bsky.feed.defs#interactionLike',
              'app.bsky.feed.defs#interactionRepost',
              'app.bsky.feed.defs#interactionReply',
              'app.bsky.feed.defs#interactionQuote',
              'app.bsky.feed.defs#interactionShare',
            ],
          },
          feedContext: {
            type: 'string',
            maxLength: 2000,
            description:
              'Context on a feed item that was originally supplied by the feed generator on getFeedSkeleton.',
          },
        },
      },
      requestLess: {
        type: 'token',
        description:
          'Request that less content like the given feed item be shown in the feed',
      },
      requestMore: {
        type: 'token',
        description:
          'Request that more content like the given feed item be shown in the feed',
      },
      viewerState: {
        type: 'object',
        properties: {
          like: {
            type: 'string',
            format: 'at-uri',
          },
          pinned: {
            type: 'boolean',
          },
          repost: {
            type: 'string',
            format: 'at-uri',
          },
          threadMuted: {
            type: 'boolean',
          },
          replyDisabled: {
            type: 'boolean',
          },
          embeddingDisabled: {
            type: 'boolean',
          },
        },
        description:
          "Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests.",
      },
      feedViewPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            ref: 'lex:app.bsky.feed.defs#postView',
            type: 'ref',
          },
          reply: {
            ref: 'lex:app.bsky.feed.defs#replyRef',
            type: 'ref',
          },
          reason: {
            refs: [
              'lex:app.bsky.feed.defs#reasonRepost',
              'lex:app.bsky.feed.defs#reasonPin',
            ],
            type: 'union',
          },
          feedContext: {
            type: 'string',
            maxLength: 2000,
            description:
              'Context provided by feed generator that may be passed back alongside interactions.',
          },
        },
      },
      notFoundPost: {
        type: 'object',
        required: ['uri', 'notFound'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          notFound: {
            type: 'boolean',
            const: true,
          },
        },
      },
      reasonRepost: {
        type: 'object',
        required: ['by', 'indexedAt'],
        properties: {
          by: {
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      blockedAuthor: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          viewer: {
            ref: 'lex:app.bsky.actor.defs#viewerState',
            type: 'ref',
          },
        },
      },
      generatorView: {
        type: 'object',
        required: ['uri', 'cid', 'did', 'creator', 'displayName', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          did: {
            type: 'string',
            format: 'did',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.feed.defs#generatorViewerState',
            type: 'ref',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileView',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
          },
          contentMode: {
            type: 'string',
            knownValues: [
              'app.bsky.feed.defs#contentModeUnspecified',
              'app.bsky.feed.defs#contentModeVideo',
            ],
          },
          description: {
            type: 'string',
            maxLength: 3000,
            maxGraphemes: 300,
          },
          displayName: {
            type: 'string',
          },
          descriptionFacets: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.richtext.facet',
              type: 'ref',
            },
          },
          acceptsInteractions: {
            type: 'boolean',
          },
        },
      },
      threadContext: {
        type: 'object',
        properties: {
          rootAuthorLike: {
            type: 'string',
            format: 'at-uri',
          },
        },
        description:
          'Metadata about this post within the context of the thread it is in.',
      },
      threadViewPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            ref: 'lex:app.bsky.feed.defs#postView',
            type: 'ref',
          },
          parent: {
            refs: [
              'lex:app.bsky.feed.defs#threadViewPost',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
            type: 'union',
          },
          replies: {
            type: 'array',
            items: {
              refs: [
                'lex:app.bsky.feed.defs#threadViewPost',
                'lex:app.bsky.feed.defs#notFoundPost',
                'lex:app.bsky.feed.defs#blockedPost',
              ],
              type: 'union',
            },
          },
          threadContext: {
            ref: 'lex:app.bsky.feed.defs#threadContext',
            type: 'ref',
          },
        },
      },
      threadgateView: {
        type: 'object',
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          lists: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.graph.defs#listViewBasic',
              type: 'ref',
            },
          },
          record: {
            type: 'unknown',
          },
        },
      },
      interactionLike: {
        type: 'token',
        description: 'User liked the feed item',
      },
      interactionSeen: {
        type: 'token',
        description: 'Feed item was seen by user',
      },
      clickthroughItem: {
        type: 'token',
        description: 'User clicked through to the feed item',
      },
      contentModeVideo: {
        type: 'token',
        description:
          'Declares the feed generator returns posts containing app.bsky.embed.video embeds.',
      },
      interactionQuote: {
        type: 'token',
        description: 'User quoted the feed item',
      },
      interactionReply: {
        type: 'token',
        description: 'User replied to the feed item',
      },
      interactionShare: {
        type: 'token',
        description: 'User shared the feed item',
      },
      skeletonFeedPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'string',
            format: 'at-uri',
          },
          reason: {
            refs: [
              'lex:app.bsky.feed.defs#skeletonReasonRepost',
              'lex:app.bsky.feed.defs#skeletonReasonPin',
            ],
            type: 'union',
          },
          feedContext: {
            type: 'string',
            maxLength: 2000,
            description:
              'Context that will be passed through to client and may be passed to feed generator back alongside interactions.',
          },
        },
      },
      clickthroughEmbed: {
        type: 'token',
        description:
          'User clicked through to the embedded content of the feed item',
      },
      interactionRepost: {
        type: 'token',
        description: 'User reposted the feed item',
      },
      skeletonReasonPin: {
        type: 'object',
        properties: {},
      },
      clickthroughAuthor: {
        type: 'token',
        description: 'User clicked through to the author of the feed item',
      },
      clickthroughReposter: {
        type: 'token',
        description: 'User clicked through to the reposter of the feed item',
      },
      generatorViewerState: {
        type: 'object',
        properties: {
          like: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      skeletonReasonRepost: {
        type: 'object',
        required: ['repost'],
        properties: {
          repost: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      contentModeUnspecified: {
        type: 'token',
        description: 'Declares the feed generator returns any types of posts.',
      },
    },
  },
  AppBskyFeedPostgate: {
    lexicon: 1,
    id: 'app.bsky.feed.postgate',
    defs: {
      main: {
        key: 'tid',
        type: 'record',
        record: {
          type: 'object',
          required: ['post', 'createdAt'],
          properties: {
            post: {
              type: 'string',
              format: 'at-uri',
              description: 'Reference (AT-URI) to the post record.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            embeddingRules: {
              type: 'array',
              items: {
                refs: ['lex:app.bsky.feed.postgate#disableRule'],
                type: 'union',
              },
              maxLength: 5,
              description:
                'List of rules defining who can embed this post. If value is an empty array or is undefined, no particular rules apply and anyone can embed.',
            },
            detachedEmbeddingUris: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 50,
              description:
                'List of AT-URIs embedding this post that the author has detached from.',
            },
          },
        },
        description:
          'Record defining interaction rules for a post. The record key (rkey) of the postgate record must match the record key of the post, and that record must be in the same repository.',
      },
      disableRule: {
        type: 'object',
        properties: {},
        description: 'Disables embedding of this post.',
      },
    },
  },
  AppBskyFeedThreadgate: {
    lexicon: 1,
    id: 'app.bsky.feed.threadgate',
    defs: {
      main: {
        key: 'tid',
        type: 'record',
        record: {
          type: 'object',
          required: ['post', 'createdAt'],
          properties: {
            post: {
              type: 'string',
              format: 'at-uri',
              description: 'Reference (AT-URI) to the post record.',
            },
            allow: {
              type: 'array',
              items: {
                refs: [
                  'lex:app.bsky.feed.threadgate#mentionRule',
                  'lex:app.bsky.feed.threadgate#followerRule',
                  'lex:app.bsky.feed.threadgate#followingRule',
                  'lex:app.bsky.feed.threadgate#listRule',
                ],
                type: 'union',
              },
              maxLength: 5,
              description:
                'List of rules defining who can reply to this post. If value is an empty array, no one can reply. If value is undefined, anyone can reply.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            hiddenReplies: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 50,
              description: 'List of hidden reply URIs.',
            },
          },
        },
        description:
          "Record defining interaction gating rules for a thread (aka, reply controls). The record key (rkey) of the threadgate record must match the record key of the thread's root post, and that record must be in the same repository.",
      },
      listRule: {
        type: 'object',
        required: ['list'],
        properties: {
          list: {
            type: 'string',
            format: 'at-uri',
          },
        },
        description: 'Allow replies from actors on a list.',
      },
      mentionRule: {
        type: 'object',
        properties: {},
        description: 'Allow replies from actors mentioned in your post.',
      },
      followerRule: {
        type: 'object',
        properties: {},
        description: 'Allow replies from actors who follow you.',
      },
      followingRule: {
        type: 'object',
        properties: {},
        description: 'Allow replies from actors you follow.',
      },
    },
  },
  AppBskyRichtextFacet: {
    lexicon: 1,
    id: 'app.bsky.richtext.facet',
    defs: {
      tag: {
        type: 'object',
        required: ['tag'],
        properties: {
          tag: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
        description:
          "Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags').",
      },
      link: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
        description:
          'Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL.',
      },
      main: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: {
            ref: 'lex:app.bsky.richtext.facet#byteSlice',
            type: 'ref',
          },
          features: {
            type: 'array',
            items: {
              refs: [
                'lex:app.bsky.richtext.facet#mention',
                'lex:app.bsky.richtext.facet#link',
                'lex:app.bsky.richtext.facet#tag',
              ],
              type: 'union',
            },
          },
        },
        description: 'Annotation of a sub-string within rich text.',
      },
      mention: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
        description:
          "Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID.",
      },
      byteSlice: {
        type: 'object',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
        },
        description:
          'Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets.',
      },
    },
  },
  AppBskyActorDefs: {
    lexicon: 1,
    id: 'app.bsky.actor.defs',
    defs: {
      nux: {
        type: 'object',
        required: ['id', 'completed'],
        properties: {
          id: {
            type: 'string',
            maxLength: 100,
          },
          data: {
            type: 'string',
            maxLength: 3000,
            description:
              'Arbitrary data for the NUX. The structure is defined by the NUX itself. Limited to 300 characters.',
            maxGraphemes: 300,
          },
          completed: {
            type: 'boolean',
            default: false,
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description:
              'The date and time at which the NUX will expire and should be considered completed.',
          },
        },
        description: 'A new user experiences (NUX) storage object',
      },
      mutedWord: {
        type: 'object',
        required: ['value', 'targets'],
        properties: {
          id: {
            type: 'string',
          },
          value: {
            type: 'string',
            maxLength: 10000,
            description: 'The muted word itself.',
            maxGraphemes: 1000,
          },
          targets: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#mutedWordTarget',
              type: 'ref',
            },
            description: 'The intended targets of the muted word.',
          },
          expiresAt: {
            type: 'string',
            format: 'datetime',
            description:
              'The date and time at which the muted word will expire and no longer be applied.',
          },
          actorTarget: {
            type: 'string',
            default: 'all',
            description:
              'Groups of users to apply the muted word to. If undefined, applies to all users.',
            knownValues: ['all', 'exclude-following'],
          },
        },
        description: 'A word that the account owner has muted.',
      },
      savedFeed: {
        type: 'object',
        required: ['id', 'type', 'value', 'pinned'],
        properties: {
          id: {
            type: 'string',
          },
          type: {
            type: 'string',
            knownValues: ['feed', 'list', 'timeline'],
          },
          value: {
            type: 'string',
          },
          pinned: {
            type: 'boolean',
          },
        },
      },
      preferences: {
        type: 'array',
        items: {
          refs: [
            'lex:app.bsky.actor.defs#adultContentPref',
            'lex:app.bsky.actor.defs#contentLabelPref',
            'lex:app.bsky.actor.defs#savedFeedsPref',
            'lex:app.bsky.actor.defs#savedFeedsPrefV2',
            'lex:app.bsky.actor.defs#personalDetailsPref',
            'lex:app.bsky.actor.defs#feedViewPref',
            'lex:app.bsky.actor.defs#threadViewPref',
            'lex:app.bsky.actor.defs#interestsPref',
            'lex:app.bsky.actor.defs#mutedWordsPref',
            'lex:app.bsky.actor.defs#hiddenPostsPref',
            'lex:app.bsky.actor.defs#bskyAppStatePref',
            'lex:app.bsky.actor.defs#labelersPref',
            'lex:app.bsky.actor.defs#postInteractionSettingsPref',
          ],
          type: 'union',
        },
      },
      profileView: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.actor.defs#viewerState',
            type: 'ref',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          associated: {
            ref: 'lex:app.bsky.actor.defs#profileAssociated',
            type: 'ref',
          },
          description: {
            type: 'string',
            maxLength: 2560,
            maxGraphemes: 256,
          },
          displayName: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
          blocking: {
            type: 'string',
            format: 'at-uri',
          },
          blockedBy: {
            type: 'boolean',
          },
          following: {
            type: 'string',
            format: 'at-uri',
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
          },
          mutedByList: {
            ref: 'lex:app.bsky.graph.defs#listViewBasic',
            type: 'ref',
          },
          blockingByList: {
            ref: 'lex:app.bsky.graph.defs#listViewBasic',
            type: 'ref',
          },
          knownFollowers: {
            ref: 'lex:app.bsky.actor.defs#knownFollowers',
            type: 'ref',
          },
        },
        description:
          "Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests.",
      },
      feedViewPref: {
        type: 'object',
        required: ['feed'],
        properties: {
          feed: {
            type: 'string',
            description:
              'The URI of the feed, or an identifier which describes the feed.',
          },
          hideReplies: {
            type: 'boolean',
            description: 'Hide replies in the feed.',
          },
          hideReposts: {
            type: 'boolean',
            description: 'Hide reposts in the feed.',
          },
          hideQuotePosts: {
            type: 'boolean',
            description: 'Hide quote posts in the feed.',
          },
          hideRepliesByLikeCount: {
            type: 'integer',
            description:
              'Hide replies in the feed if they do not have this number of likes.',
          },
          hideRepliesByUnfollowed: {
            type: 'boolean',
            default: true,
            description:
              'Hide replies in the feed if they are not by followed users.',
          },
        },
      },
      labelersPref: {
        type: 'object',
        required: ['labelers'],
        properties: {
          labelers: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#labelerPrefItem',
              type: 'ref',
            },
          },
        },
      },
      interestsPref: {
        type: 'object',
        required: ['tags'],
        properties: {
          tags: {
            type: 'array',
            items: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
            },
            maxLength: 100,
            description:
              "A list of tags which describe the account owner's interests gathered during onboarding.",
          },
        },
      },
      knownFollowers: {
        type: 'object',
        required: ['count', 'followers'],
        properties: {
          count: {
            type: 'integer',
          },
          followers: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#profileViewBasic',
              type: 'ref',
            },
            maxLength: 5,
            minLength: 0,
          },
        },
        description: "The subject's followers whom you also follow",
      },
      mutedWordsPref: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#mutedWord',
              type: 'ref',
            },
            description: 'A list of words the account owner has muted.',
          },
        },
      },
      savedFeedsPref: {
        type: 'object',
        required: ['pinned', 'saved'],
        properties: {
          saved: {
            type: 'array',
            items: {
              type: 'string',
              format: 'at-uri',
            },
          },
          pinned: {
            type: 'array',
            items: {
              type: 'string',
              format: 'at-uri',
            },
          },
          timelineIndex: {
            type: 'integer',
          },
        },
      },
      threadViewPref: {
        type: 'object',
        properties: {
          sort: {
            type: 'string',
            description: 'Sorting mode for threads.',
            knownValues: [
              'oldest',
              'newest',
              'most-likes',
              'random',
              'hotness',
            ],
          },
          prioritizeFollowedUsers: {
            type: 'boolean',
            description: 'Show followed users at the top of all replies.',
          },
        },
      },
      hiddenPostsPref: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'string',
              format: 'at-uri',
            },
            description:
              'A list of URIs of posts the account owner has hidden.',
          },
        },
      },
      labelerPrefItem: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      mutedWordTarget: {
        type: 'string',
        maxLength: 640,
        knownValues: ['content', 'tag'],
        maxGraphemes: 64,
      },
      adultContentPref: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: {
            type: 'boolean',
            default: false,
          },
        },
      },
      bskyAppStatePref: {
        type: 'object',
        properties: {
          nuxs: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#nux',
              type: 'ref',
            },
            maxLength: 100,
            description: 'Storage for NUXs the user has encountered.',
          },
          queuedNudges: {
            type: 'array',
            items: {
              type: 'string',
              maxLength: 100,
            },
            maxLength: 1000,
            description:
              'An array of tokens which identify nudges (modals, popups, tours, highlight dots) that should be shown to the user.',
          },
          activeProgressGuide: {
            ref: 'lex:app.bsky.actor.defs#bskyAppProgressGuide',
            type: 'ref',
          },
        },
        description:
          "A grab bag of state that's specific to the bsky.app program. Third-party apps shouldn't use this.",
      },
      contentLabelPref: {
        type: 'object',
        required: ['label', 'visibility'],
        properties: {
          label: {
            type: 'string',
          },
          labelerDid: {
            type: 'string',
            format: 'did',
            description:
              'Which labeler does this preference apply to? If undefined, applies globally.',
          },
          visibility: {
            type: 'string',
            knownValues: ['ignore', 'show', 'warn', 'hide'],
          },
        },
      },
      profileViewBasic: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.actor.defs#viewerState',
            type: 'ref',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          associated: {
            ref: 'lex:app.bsky.actor.defs#profileAssociated',
            type: 'ref',
          },
          displayName: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
      },
      savedFeedsPrefV2: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              ref: 'lex:app.bsky.actor.defs#savedFeed',
              type: 'ref',
            },
          },
        },
      },
      profileAssociated: {
        type: 'object',
        properties: {
          chat: {
            ref: 'lex:app.bsky.actor.defs#profileAssociatedChat',
            type: 'ref',
          },
          lists: {
            type: 'integer',
          },
          labeler: {
            type: 'boolean',
          },
          feedgens: {
            type: 'integer',
          },
          starterPacks: {
            type: 'integer',
          },
        },
      },
      personalDetailsPref: {
        type: 'object',
        properties: {
          birthDate: {
            type: 'string',
            format: 'datetime',
            description: 'The birth date of account owner.',
          },
        },
      },
      profileViewDetailed: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          banner: {
            type: 'string',
            format: 'uri',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.actor.defs#viewerState',
            type: 'ref',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          associated: {
            ref: 'lex:app.bsky.actor.defs#profileAssociated',
            type: 'ref',
          },
          pinnedPost: {
            ref: 'lex:com.atproto.repo.strongRef',
            type: 'ref',
          },
          postsCount: {
            type: 'integer',
          },
          description: {
            type: 'string',
            maxLength: 2560,
            maxGraphemes: 256,
          },
          displayName: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
          },
          followsCount: {
            type: 'integer',
          },
          followersCount: {
            type: 'integer',
          },
          joinedViaStarterPack: {
            ref: 'lex:app.bsky.graph.defs#starterPackViewBasic',
            type: 'ref',
          },
        },
      },
      bskyAppProgressGuide: {
        type: 'object',
        required: ['guide'],
        properties: {
          guide: {
            type: 'string',
            maxLength: 100,
          },
        },
        description:
          'If set, an active progress guide. Once completed, can be set to undefined. Should have unspecced fields tracking progress.',
      },
      profileAssociatedChat: {
        type: 'object',
        required: ['allowIncoming'],
        properties: {
          allowIncoming: {
            type: 'string',
            knownValues: ['all', 'none', 'following'],
          },
        },
      },
      postInteractionSettingsPref: {
        type: 'object',
        required: [],
        properties: {
          threadgateAllowRules: {
            type: 'array',
            items: {
              refs: [
                'lex:app.bsky.feed.threadgate#mentionRule',
                'lex:app.bsky.feed.threadgate#followerRule',
                'lex:app.bsky.feed.threadgate#followingRule',
                'lex:app.bsky.feed.threadgate#listRule',
              ],
              type: 'union',
            },
            maxLength: 5,
            description:
              'Matches threadgate record. List of rules defining who can reply to this users posts. If value is an empty array, no one can reply. If value is undefined, anyone can reply.',
          },
          postgateEmbeddingRules: {
            type: 'array',
            items: {
              refs: ['lex:app.bsky.feed.postgate#disableRule'],
              type: 'union',
            },
            maxLength: 5,
            description:
              'Matches postgate record. List of rules defining who can embed this users posts. If value is an empty array or is undefined, no particular rules apply and anyone can embed.',
          },
        },
        description:
          'Default post interaction settings for the account. These values should be applied as default values when creating new posts. These refs should mirror the threadgate and postgate records exactly.',
      },
    },
  },
  AppBskyActorProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        key: 'literal:self',
        type: 'record',
        record: {
          type: 'object',
          properties: {
            avatar: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
            },
            banner: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
              description:
                'Larger horizontal image to display behind profile view.',
            },
            labels: {
              refs: ['lex:com.atproto.label.defs#selfLabels'],
              type: 'union',
              description:
                'Self-label values, specific to the Bluesky application, on the overall account.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            pinnedPost: {
              ref: 'lex:com.atproto.repo.strongRef',
              type: 'ref',
            },
            description: {
              type: 'string',
              maxLength: 2560,
              description: 'Free-form profile description text.',
              maxGraphemes: 256,
            },
            displayName: {
              type: 'string',
              maxLength: 640,
              maxGraphemes: 64,
            },
            joinedViaStarterPack: {
              ref: 'lex:com.atproto.repo.strongRef',
              type: 'ref',
            },
          },
        },
        description: 'A declaration of a Bluesky account profile.',
      },
    },
  },
  AppBskyLabelerDefs: {
    lexicon: 1,
    id: 'app.bsky.labeler.defs',
    defs: {
      labelerView: {
        type: 'object',
        required: ['uri', 'cid', 'creator', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.labeler.defs#labelerViewerState',
            type: 'ref',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileView',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      labelerPolicies: {
        type: 'object',
        required: ['labelValues'],
        properties: {
          labelValues: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#labelValue',
              type: 'ref',
            },
            description:
              'The label values which this labeler publishes. May include global or custom labels.',
          },
          labelValueDefinitions: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#labelValueDefinition',
              type: 'ref',
            },
            description:
              'Label values created by this labeler and scoped exclusively to it. Labels defined here will override global label definitions for this labeler.',
          },
        },
      },
      labelerViewerState: {
        type: 'object',
        properties: {
          like: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      labelerViewDetailed: {
        type: 'object',
        required: ['uri', 'cid', 'creator', 'policies', 'indexedAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          labels: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#label',
              type: 'ref',
            },
          },
          viewer: {
            ref: 'lex:app.bsky.labeler.defs#labelerViewerState',
            type: 'ref',
          },
          creator: {
            ref: 'lex:app.bsky.actor.defs#profileView',
            type: 'ref',
          },
          policies: {
            ref: 'lex:app.bsky.labeler.defs#labelerPolicies',
            type: 'ref',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
  SocialGrainDefs: {
    lexicon: 1,
    id: 'social.grain.defs',
    defs: {
      aspectRatio: {
        type: 'object',
        description:
          'width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit.',
        required: ['width', 'height'],
        properties: {
          width: {
            type: 'integer',
            minimum: 1,
          },
          height: {
            type: 'integer',
            minimum: 1,
          },
        },
      },
    },
  },
  SocialGrainGalleryItem: {
    lexicon: 1,
    id: 'social.grain.gallery.item',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['createdAt', 'gallery', 'item'],
          properties: {
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            gallery: {
              type: 'string',
              format: 'at-uri',
            },
            item: {
              type: 'string',
              format: 'at-uri',
            },
            position: {
              type: 'integer',
              default: 0,
            },
          },
        },
      },
    },
  },
  SocialGrainGalleryDefs: {
    lexicon: 1,
    id: 'social.grain.gallery.defs',
    defs: {
      galleryView: {
        type: 'object',
        required: ['uri', 'cid', 'creator', 'record', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          creator: {
            type: 'ref',
            ref: 'lex:social.grain.actor.defs#profileView',
          },
          record: {
            type: 'unknown',
          },
          items: {
            type: 'array',
            items: {
              type: 'union',
              refs: ['lex:social.grain.photo.defs#photoView'],
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  SocialGrainGallery: {
    lexicon: 1,
    id: 'social.grain.gallery',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['title', 'createdAt'],
          properties: {
            title: {
              type: 'string',
              maxLength: 100,
            },
            description: {
              type: 'string',
              maxLength: 1000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  SocialGrainFavorite: {
    lexicon: 1,
    id: 'social.grain.favorite',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['createdAt', 'subject'],
          properties: {
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            subject: {
              type: 'string',
              format: 'at-uri',
            },
          },
        },
      },
    },
  },
  SocialGrainActorDefs: {
    lexicon: 1,
    id: 'social.grain.actor.defs',
    defs: {
      profileView: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          description: {
            type: 'string',
            maxLength: 2560,
            maxGraphemes: 256,
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  SocialGrainActorProfile: {
    lexicon: 1,
    id: 'social.grain.actor.profile',
    defs: {
      main: {
        type: 'record',
        description: 'A declaration of a basic account profile.',
        key: 'literal:self',
        record: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: 'string',
              description: 'Free-form profile description text.',
              maxGraphemes: 256,
              maxLength: 2560,
            },
            avatar: {
              type: 'blob',
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  SocialGrainPhotoDefs: {
    lexicon: 1,
    id: 'social.grain.photo.defs',
    defs: {
      photoView: {
        type: 'object',
        required: ['uri', 'cid', 'thumb', 'fullsize', 'alt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          thumb: {
            type: 'string',
            format: 'uri',
            description:
              'Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View.',
          },
          fullsize: {
            type: 'string',
            format: 'uri',
            description:
              'Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View.',
          },
          alt: {
            type: 'string',
            description:
              'Alt text description of the image, for accessibility.',
          },
          aspectRatio: {
            type: 'ref',
            ref: 'lex:social.grain.defs#aspectRatio',
          },
        },
      },
    },
  },
  SocialGrainPhoto: {
    lexicon: 1,
    id: 'social.grain.photo',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['photo', 'alt'],
          properties: {
            photo: {
              type: 'blob',
              accept: ['image/*'],
              maxSize: 1000000,
            },
            alt: {
              type: 'string',
              description:
                'Alt text description of the image, for accessibility.',
            },
            aspectRatio: {
              type: 'ref',
              ref: 'lex:social.grain.defs#aspectRatio',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  ComAtprotoLabelDefs: {
    lexicon: 1,
    id: 'com.atproto.label.defs',
    defs: {
      label: {
        type: 'object',
        required: ['src', 'uri', 'val', 'cts'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
            description:
              "Optionally, CID specifying the specific version of 'uri' resource this label applies to.",
          },
          cts: {
            type: 'string',
            format: 'datetime',
            description: 'Timestamp when this label was created.',
          },
          exp: {
            type: 'string',
            format: 'datetime',
            description:
              'Timestamp at which this label expires (no longer applies).',
          },
          neg: {
            type: 'boolean',
            description:
              'If true, this is a negation label, overwriting a previous label.',
          },
          sig: {
            type: 'bytes',
            description: 'Signature of dag-cbor encoded label.',
          },
          src: {
            type: 'string',
            format: 'did',
            description: 'DID of the actor who created this label.',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description:
              'AT URI of the record, repository (account), or other resource that this label applies to.',
          },
          val: {
            type: 'string',
            maxLength: 128,
            description:
              'The short string name of the value or type of this label.',
          },
          ver: {
            type: 'integer',
            description: 'The AT Protocol version of the label object.',
          },
        },
        description:
          'Metadata tag on an atproto resource (eg, repo or record).',
      },
      selfLabel: {
        type: 'object',
        required: ['val'],
        properties: {
          val: {
            type: 'string',
            maxLength: 128,
            description:
              'The short string name of the value or type of this label.',
          },
        },
        description:
          'Metadata tag on an atproto record, published by the author within the record. Note that schemas should use #selfLabels, not #selfLabel.',
      },
      labelValue: {
        type: 'string',
        knownValues: [
          '!hide',
          '!no-promote',
          '!warn',
          '!no-unauthenticated',
          'dmca-violation',
          'doxxing',
          'porn',
          'sexual',
          'nudity',
          'nsfl',
          'gore',
        ],
      },
      selfLabels: {
        type: 'object',
        required: ['values'],
        properties: {
          values: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#selfLabel',
              type: 'ref',
            },
            maxLength: 10,
          },
        },
        description:
          'Metadata tags on an atproto record, published by the author within the record.',
      },
      labelValueDefinition: {
        type: 'object',
        required: ['identifier', 'severity', 'blurs', 'locales'],
        properties: {
          blurs: {
            type: 'string',
            description:
              "What should this label hide in the UI, if applied? 'content' hides all of the target; 'media' hides the images/video/audio; 'none' hides nothing.",
            knownValues: ['content', 'media', 'none'],
          },
          locales: {
            type: 'array',
            items: {
              ref: 'lex:com.atproto.label.defs#labelValueDefinitionStrings',
              type: 'ref',
            },
          },
          severity: {
            type: 'string',
            description:
              "How should a client visually convey this label? 'inform' means neutral and informational; 'alert' means negative and warning; 'none' means show nothing.",
            knownValues: ['inform', 'alert', 'none'],
          },
          adultOnly: {
            type: 'boolean',
            description:
              'Does the user need to have adult content enabled in order to configure this label?',
          },
          identifier: {
            type: 'string',
            maxLength: 100,
            description:
              "The value of the label being defined. Must only include lowercase ascii and the '-' character ([a-z-]+).",
            maxGraphemes: 100,
          },
          defaultSetting: {
            type: 'string',
            default: 'warn',
            description: 'The default setting for this label.',
            knownValues: ['ignore', 'warn', 'hide'],
          },
        },
        description:
          'Declares a label value and its expected interpretations and behaviors.',
      },
      labelValueDefinitionStrings: {
        type: 'object',
        required: ['lang', 'name', 'description'],
        properties: {
          lang: {
            type: 'string',
            format: 'language',
            description:
              'The code of the language these strings are written in.',
          },
          name: {
            type: 'string',
            maxLength: 640,
            description: 'A short human-readable name for the label.',
            maxGraphemes: 64,
          },
          description: {
            type: 'string',
            maxLength: 100000,
            description:
              'A longer description of what the label means and why it might be applied.',
            maxGraphemes: 10000,
          },
        },
        description:
          'Strings which describe the label in the UI, localized into a specific language.',
      },
    },
  },
  ComAtprotoRepoStrongRef: {
    lexicon: 1,
    id: 'com.atproto.repo.strongRef',
    description: 'A URI with a content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AppBskyEmbedDefs: 'app.bsky.embed.defs',
  AppBskyEmbedRecord: 'app.bsky.embed.record',
  AppBskyEmbedImages: 'app.bsky.embed.images',
  AppBskyEmbedRecordWithMedia: 'app.bsky.embed.recordWithMedia',
  AppBskyEmbedVideo: 'app.bsky.embed.video',
  AppBskyEmbedExternal: 'app.bsky.embed.external',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskyGraphDefs: 'app.bsky.graph.defs',
  AppBskyFeedDefs: 'app.bsky.feed.defs',
  AppBskyFeedPostgate: 'app.bsky.feed.postgate',
  AppBskyFeedThreadgate: 'app.bsky.feed.threadgate',
  AppBskyRichtextFacet: 'app.bsky.richtext.facet',
  AppBskyActorDefs: 'app.bsky.actor.defs',
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyLabelerDefs: 'app.bsky.labeler.defs',
  SocialGrainDefs: 'social.grain.defs',
  SocialGrainGalleryItem: 'social.grain.gallery.item',
  SocialGrainGalleryDefs: 'social.grain.gallery.defs',
  SocialGrainGallery: 'social.grain.gallery',
  SocialGrainFavorite: 'social.grain.favorite',
  SocialGrainActorDefs: 'social.grain.actor.defs',
  SocialGrainActorProfile: 'social.grain.actor.profile',
  SocialGrainPhotoDefs: 'social.grain.photo.defs',
  SocialGrainPhoto: 'social.grain.photo',
  ComAtprotoLabelDefs: 'com.atproto.label.defs',
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
} as const
