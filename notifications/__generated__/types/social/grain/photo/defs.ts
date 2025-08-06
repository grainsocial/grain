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
  alt?: string
  aspectRatio: SocialGrainDefs.AspectRatio
  exif?: ExifView
  gallery?: GalleryState
}

const hashPhotoView = 'photoView'

export function isPhotoView<V>(v: V) {
  return is$typed(v, id, hashPhotoView)
}

export function validatePhotoView<V>(v: V) {
  return validate<PhotoView & V>(v, id, hashPhotoView)
}

export interface ExifView {
  $type?: 'social.grain.photo.defs#exifView'
  uri: string
  cid: string
  photo: string
  record: { [_ in string]: unknown }
  createdAt: string
  dateTimeOriginal?: string
  exposureTime?: string
  fNumber?: string
  flash?: string
  focalLengthIn35mmFormat?: string
  iSO?: number
  lensMake?: string
  lensModel?: string
  make?: string
  model?: string
}

const hashExifView = 'exifView'

export function isExifView<V>(v: V) {
  return is$typed(v, id, hashExifView)
}

export function validateExifView<V>(v: V) {
  return validate<ExifView & V>(v, id, hashExifView)
}

/** Metadata about the photo's relationship with the subject content. Only has meaningful content when photo is attached to a gallery. */
export interface GalleryState {
  $type?: 'social.grain.photo.defs#galleryState'
  item: string
  itemCreatedAt: string
  itemPosition: number
}

const hashGalleryState = 'galleryState'

export function isGalleryState<V>(v: V) {
  return is$typed(v, id, hashGalleryState)
}

export function validateGalleryState<V>(v: V) {
  return validate<GalleryState & V>(v, id, hashGalleryState)
}
