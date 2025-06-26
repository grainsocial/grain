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
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.actor.defs'

export interface ProfileView {
  $type?: 'social.grain.actor.defs#profileView'
  did: string
  handle: string
  displayName?: string
  description?: string
  labels?: ComAtprotoLabelDefs.Label[]
  avatar?: string
  createdAt?: string
}

const hashProfileView = 'profileView'

export function isProfileView<V>(v: V) {
  return is$typed(v, id, hashProfileView)
}

export function validateProfileView<V>(v: V) {
  return validate<ProfileView & V>(v, id, hashProfileView)
}

export interface ProfileViewDetailed {
  $type?: 'social.grain.actor.defs#profileViewDetailed'
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  followersCount?: number
  followsCount?: number
  galleryCount?: number
  indexedAt?: string
  createdAt?: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
}

const hashProfileViewDetailed = 'profileViewDetailed'

export function isProfileViewDetailed<V>(v: V) {
  return is$typed(v, id, hashProfileViewDetailed)
}

export function validateProfileViewDetailed<V>(v: V) {
  return validate<ProfileViewDetailed & V>(v, id, hashProfileViewDetailed)
}

/** Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests. */
export interface ViewerState {
  $type?: 'social.grain.actor.defs#viewerState'
  following?: string
  followedBy?: string
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}
