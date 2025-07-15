/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../lexicons.ts'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util.ts'
import type * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet.ts'
import type * as ComAtprotoLabelDefs from '../../com/atproto/label/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.gallery'

export interface Record {
  $type: 'social.grain.gallery'
  title: string
  description?: string
  /** Annotations of description text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  updatedAt?: string
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
