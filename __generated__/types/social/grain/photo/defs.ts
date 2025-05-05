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
import type * as SocialGrainDefs from '../defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.photo.defs'

export interface PhotoView {
  $type?: 'social.grain.photo.defs#photoView'
  uri: string
  cid: string
  /** Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View. */
  thumb: string
  /** Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View. */
  fullsize: string
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: SocialGrainDefs.AspectRatio
}

const hashPhotoView = 'photoView'

export function isPhotoView<V>(v: V) {
  return is$typed(v, id, hashPhotoView)
}

export function validatePhotoView<V>(v: V) {
  return validate<PhotoView & V>(v, id, hashPhotoView)
}
