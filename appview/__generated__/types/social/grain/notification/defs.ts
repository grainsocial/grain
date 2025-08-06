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
import type * as SocialGrainCommentDefs from '../comment/defs.ts'
import type * as SocialGrainGalleryDefs from '../gallery/defs.ts'

const is$typed = _is$typed,
  validate = _validate
const id = 'social.grain.notification.defs'

export interface NotificationView {
  $type?: 'social.grain.notification.defs#notificationView'
  uri: string
  cid: string
  author: SocialGrainActorDefs.ProfileView
  reasonSubject?: string
  /** The reason why this notification was delivered - e.g. your gallery was favd, or you received a new follower. */
  reason:
    | 'follow'
    | 'gallery-favorite'
    | 'gallery-comment'
    | 'reply'
    | 'gallery-mention'
    | 'gallery-comment-mention'
    | 'unknown'
    | (string & {})
  record: { [_ in string]: unknown }
  isRead: boolean
  indexedAt: string
}

const hashNotificationView = 'notificationView'

export function isNotificationView<V>(v: V) {
  return is$typed(v, id, hashNotificationView)
}

export function validateNotificationView<V>(v: V) {
  return validate<NotificationView & V>(v, id, hashNotificationView)
}

export interface NotificationViewDetailed {
  $type?: 'social.grain.notification.defs#notificationViewDetailed'
  uri: string
  cid: string
  author: SocialGrainActorDefs.ProfileView
  /** The reason why this notification was delivered - e.g. your gallery was favd, or you received a new follower. */
  reason:
    | 'follow'
    | 'gallery-favorite'
    | 'gallery-comment'
    | 'reply'
    | 'gallery-mention'
    | 'gallery-comment-mention'
    | 'unknown'
    | (string & {})
  reasonSubject?:
    | $Typed<SocialGrainActorDefs.ProfileView>
    | $Typed<SocialGrainCommentDefs.CommentView>
    | $Typed<SocialGrainGalleryDefs.GalleryView>
    | { $type: string }
  record: { [_ in string]: unknown }
  isRead: boolean
  indexedAt: string
}

const hashNotificationViewDetailed = 'notificationViewDetailed'

export function isNotificationViewDetailed<V>(v: V) {
  return is$typed(v, id, hashNotificationViewDetailed)
}

export function validateNotificationViewDetailed<V>(v: V) {
  return validate<NotificationViewDetailed & V>(
    v,
    id,
    hashNotificationViewDetailed,
  )
}
