/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../../lexicons.ts'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.photo.exif'

export interface Record {
  $type: 'social.grain.photo.exif'
  photo: string
  createdAt: string
  dateTimeOriginal?: string
  exposureTime?: number
  fNumber?: number
  flash?: string
  focalLengthIn35mmFormat?: number
  iSO?: number
  lensMake?: string
  lensModel?: string
  make?: string
  model?: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
