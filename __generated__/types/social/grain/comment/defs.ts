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
import type * as SocialGrainGalleryDefs from '../gallery/defs.ts'
import type * as SocialGrainPhotoDefs from '../photo/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.comment.defs'

export interface CommentView {
  $type?: 'social.grain.comment.defs#commentView'
  uri: string
  cid: string
  author: SocialGrainActorDefs.ProfileView
  record?: { [_ in string]: unknown }
  text: string
  subject?: $Typed<SocialGrainGalleryDefs.GalleryView> | { $type: string }
  focus?: $Typed<SocialGrainPhotoDefs.PhotoView> | { $type: string }
  /** The URI of the comment this comment is replying to, if applicable. */
  replyTo?: string
  createdAt: string
}

const hashCommentView = 'commentView'

export function isCommentView<V>(v: V) {
  return is$typed(v, id, hashCommentView)
}

export function validateCommentView<V>(v: V) {
  return validate<CommentView & V>(v, id, hashCommentView)
}
