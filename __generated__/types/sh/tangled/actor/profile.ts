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
const id = 'sh.tangled.actor.profile'

export interface Record {
  $type: 'sh.tangled.actor.profile'
  /** Free-form profile description text. */
  description?: string
  links?: string[]
  stats?:
    | 'merged-pull-request-count'
    | 'closed-pull-request-count'
    | 'open-pull-request-count'
    | 'open-issue-count'
    | 'closed-issue-count'
    | 'repository-count'[]
  /** Include link to this account on Bluesky. */
  bluesky: boolean
  /** Free-form location text. */
  location?: string
  /** Any ATURI, it is up to appviews to validate these fields. */
  pinnedRepositories?: string[]
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
