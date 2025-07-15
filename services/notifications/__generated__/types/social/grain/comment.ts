/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../lexicons.ts'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util.ts'
import type * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.comment'

export interface Record {
  $type: 'social.grain.comment'
  text: string
  /** Annotations of description text (mentions and URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  subject: string
  focus?: string
  replyTo?: string
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
