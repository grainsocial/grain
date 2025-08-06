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
const id = 'app.bsky.feed.postgate'

export interface Record {
  $type: 'app.bsky.feed.postgate'
  /** Reference (AT-URI) to the post record. */
  post: string
  createdAt: string
  /** List of rules defining who can embed this post. If value is an empty array or is undefined, no particular rules apply and anyone can embed. */
  embeddingRules?: ($Typed<DisableRule> | { $type: string })[]
  /** List of AT-URIs embedding this post that the author has detached from. */
  detachedEmbeddingUris?: string[]
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

/** Disables embedding of this post. */
export interface DisableRule {
  $type?: 'app.bsky.feed.postgate#disableRule'
}

const hashDisableRule = 'disableRule'

export function isDisableRule<V>(v: V) {
  return is$typed(v, id, hashDisableRule)
}

export function validateDisableRule<V>(v: V) {
  return validate<DisableRule & V>(v, id, hashDisableRule)
}
