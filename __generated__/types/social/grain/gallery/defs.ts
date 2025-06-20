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
import type * as SocialGrainActorDefs from '../actor/defs.ts'
import type * as SocialGrainPhotoDefs from '../photo/defs.ts'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.gallery.defs'

export interface GalleryView {
  $type?: 'social.grain.gallery.defs#galleryView'
  uri: string
  cid: string
  creator: SocialGrainActorDefs.ProfileView
  record: { [_ in string]: unknown }
  items?: ($Typed<SocialGrainPhotoDefs.PhotoView> | { $type: string })[]
  favCount?: number
  commentCount?: number
  labels?: ComAtprotoLabelDefs.Label[]
  indexedAt: string
  viewer?: ViewerState
}

const hashGalleryView = 'galleryView'

export function isGalleryView<V>(v: V) {
  return is$typed(v, id, hashGalleryView)
}

export function validateGalleryView<V>(v: V) {
  return validate<GalleryView & V>(v, id, hashGalleryView)
}

/** Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests. */
export interface ViewerState {
  $type?: 'social.grain.gallery.defs#viewerState'
  fav?: string
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}
