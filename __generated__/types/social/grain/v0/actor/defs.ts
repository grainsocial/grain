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

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.v0.actor.defs'

export interface ProfileView {
  $type?: 'social.grain.v0.actor.defs#profileView'
  did: string
  handle: string
  displayName?: string
  description?: string
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
