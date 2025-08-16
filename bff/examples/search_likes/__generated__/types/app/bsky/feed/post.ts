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
import type * as AppBskyEmbedImages from '../embed/images.ts'
import type * as AppBskyEmbedVideo from '../embed/video.ts'
import type * as AppBskyEmbedExternal from '../embed/external.ts'
import type * as AppBskyEmbedRecord from '../embed/record.ts'
import type * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia.ts'
import type * as AppBskyRichtextFacet from '../richtext/facet.ts'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.ts'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.post'

export interface Record {
  $type: 'app.bsky.feed.post'
  /** Additional hashtags, in addition to any included in post text and facets. */
  tags?: string[]
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  embed?:
    | $Typed<AppBskyEmbedImages.Main>
    | $Typed<AppBskyEmbedVideo.Main>
    | $Typed<AppBskyEmbedExternal.Main>
    | $Typed<AppBskyEmbedRecord.Main>
    | $Typed<AppBskyEmbedRecordWithMedia.Main>
    | { $type: string }
  /** Indicates human language of post primary text content. */
  langs?: string[]
  reply?: ReplyRef
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  /** DEPRECATED: replaced by app.bsky.richtext.facet. */
  entities?: Entity[]
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

/** Deprecated: use facets instead. */
export interface Entity {
  $type?: 'app.bsky.feed.post#entity'
  /** Expected values are 'mention' and 'link'. */
  type: string
  index: TextSlice
  value: string
}

const hashEntity = 'entity'

export function isEntity<V>(v: V) {
  return is$typed(v, id, hashEntity)
}

export function validateEntity<V>(v: V) {
  return validate<Entity & V>(v, id, hashEntity)
}

export interface ReplyRef {
  $type?: 'app.bsky.feed.post#replyRef'
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
}

const hashReplyRef = 'replyRef'

export function isReplyRef<V>(v: V) {
  return is$typed(v, id, hashReplyRef)
}

export function validateReplyRef<V>(v: V) {
  return validate<ReplyRef & V>(v, id, hashReplyRef)
}

/** Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings. */
export interface TextSlice {
  $type?: 'app.bsky.feed.post#textSlice'
  end: number
  start: number
}

const hashTextSlice = 'textSlice'

export function isTextSlice<V>(v: V) {
  return is$typed(v, id, hashTextSlice)
}

export function validateTextSlice<V>(v: V) {
  return validate<TextSlice & V>(v, id, hashTextSlice)
}
