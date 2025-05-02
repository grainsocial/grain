/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from "npm:@atproto/lexicon"
import { CID } from "npm:multiformats/cid"
import { validate as _validate } from '../../../../../lexicons.ts'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../util.ts'
import type * as SocialGrainV0ActorDefs from '../actor/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.v0.gallery.defs'

/** width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit. */
export interface AspectRatio {
  $type?: 'social.grain.v0.gallery.defs#aspectRatio'
  width: number
  height: number
}

const hashAspectRatio = 'aspectRatio'

export function isAspectRatio<V>(v: V) {
  return is$typed(v, id, hashAspectRatio)
}

export function validateAspectRatio<V>(v: V) {
  return validate<AspectRatio & V>(v, id, hashAspectRatio)
}

export interface GalleryView {
  $type?: 'social.grain.v0.gallery.defs#galleryView'
  uri: string
  cid: string
  creator: SocialGrainV0ActorDefs.ProfileView
  record: { [_ in string]: unknown }
  images?: ViewImage[]
  indexedAt: string
}

const hashGalleryView = 'galleryView'

export function isGalleryView<V>(v: V) {
  return is$typed(v, id, hashGalleryView)
}

export function validateGalleryView<V>(v: V) {
  return validate<GalleryView & V>(v, id, hashGalleryView)
}

export interface Image {
  $type?: 'social.grain.v0.gallery.defs#image'
  image: BlobRef
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AspectRatio
}

const hashImage = 'image'

export function isImage<V>(v: V) {
  return is$typed(v, id, hashImage)
}

export function validateImage<V>(v: V) {
  return validate<Image & V>(v, id, hashImage)
}

export interface ViewImage {
  $type?: 'social.grain.v0.gallery.defs#viewImage'
  cid: string
  /** Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View. */
  thumb: string
  /** Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View. */
  fullsize: string
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AspectRatio
}

const hashViewImage = 'viewImage'

export function isViewImage<V>(v: V) {
  return is$typed(v, id, hashViewImage)
}

export function validateViewImage<V>(v: V) {
  return validate<ViewImage & V>(v, id, hashViewImage)
}
