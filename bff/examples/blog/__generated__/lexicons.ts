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
  ComWhtwndBlogEntry: {
    lexicon: 1,
    id: 'com.whtwnd.blog.entry',
    defs: {
      main: {
        type: 'record',
        description: 'A declaration of a post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              maxLength: 100000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
            title: {
              type: 'string',
              maxLength: 1000,
            },
            subtitle: {
              type: 'string',
              maxLength: 1000,
            },
            ogp: {
              type: 'ref',
              ref: 'lex:com.whtwnd.blog.defs#ogp',
            },
            theme: {
              type: 'string',
              enum: ['github-light'],
            },
            blobs: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:com.whtwnd.blog.defs#blobMetadata',
              },
            },
            isDraft: {
              type: 'boolean',
              description:
                '(DEPRECATED) Marks this entry as draft to tell AppViews not to show it to anyone except for the author',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'url', 'author'],
              default: 'public',
              description: 'Tells the visibility of the article to AppView.',
            },
          },
        },
      },
    },
  },
  ComWhtwndBlogDefs: {
    lexicon: 1,
    id: 'com.whtwnd.blog.defs',
    defs: {
      blogEntry: {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            maxLength: 100000,
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      comment: {
        type: 'object',
        required: ['content', 'entryUri'],
        properties: {
          content: {
            type: 'string',
            maxLength: 1000,
          },
          entryUri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      ogp: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
          },
          width: {
            type: 'integer',
          },
          height: {
            type: 'integer',
          },
        },
      },
      blobMetadata: {
        type: 'object',
        required: ['blobref'],
        properties: {
          blobref: {
            type: 'blob',
            accept: ['*/*'],
          },
          name: {
            type: 'string',
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
  ComWhtwndBlogEntry: 'com.whtwnd.blog.entry',
  ComWhtwndBlogDefs: 'com.whtwnd.blog.defs',
} as const
