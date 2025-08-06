/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../lexicons.ts'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util.ts'
import type * as SocialGrainDefs from './defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.photo'

export interface Record {
  $type: 'social.grain.photo'
  photo: BlobRef
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: SocialGrainDefs.AspectRatio
  createdAt?: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
