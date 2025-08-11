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
const id = 'com.whtwnd.blog.defs'

export interface BlogEntry {
  $type?: 'com.whtwnd.blog.defs#blogEntry'
  content: string
  createdAt?: string
}

const hashBlogEntry = 'blogEntry'

export function isBlogEntry<V>(v: V) {
  return is$typed(v, id, hashBlogEntry)
}

export function validateBlogEntry<V>(v: V) {
  return validate<BlogEntry & V>(v, id, hashBlogEntry)
}

export interface Comment {
  $type?: 'com.whtwnd.blog.defs#comment'
  content: string
  entryUri: string
}

const hashComment = 'comment'

export function isComment<V>(v: V) {
  return is$typed(v, id, hashComment)
}

export function validateComment<V>(v: V) {
  return validate<Comment & V>(v, id, hashComment)
}

export interface Ogp {
  $type?: 'com.whtwnd.blog.defs#ogp'
  url: string
  width?: number
  height?: number
}

const hashOgp = 'ogp'

export function isOgp<V>(v: V) {
  return is$typed(v, id, hashOgp)
}

export function validateOgp<V>(v: V) {
  return validate<Ogp & V>(v, id, hashOgp)
}

export interface BlobMetadata {
  $type?: 'com.whtwnd.blog.defs#blobMetadata'
  blobref: BlobRef
  name?: string
}

const hashBlobMetadata = 'blobMetadata'

export function isBlobMetadata<V>(v: V) {
  return is$typed(v, id, hashBlobMetadata)
}

export function validateBlobMetadata<V>(v: V) {
  return validate<BlobMetadata & V>(v, id, hashBlobMetadata)
}
