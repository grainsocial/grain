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
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.actor.profile'

export interface Record {
  $type: 'app.bsky.actor.profile'
  /** Small image to be displayed next to posts from account. AKA, 'profile picture' */
  avatar?: BlobRef
  /** Larger horizontal image to display behind profile view. */
  banner?: BlobRef
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  createdAt?: string
  pinnedPost?: ComAtprotoRepoStrongRef.Main
  /** Free-form profile description text. */
  description?: string
  displayName?: string
  joinedViaStarterPack?: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
