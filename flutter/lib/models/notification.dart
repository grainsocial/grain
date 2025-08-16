import 'package:freezed_annotation/freezed_annotation.dart';

import 'comment.dart';
import 'gallery.dart';
import 'profile.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

@freezed
class Notification with _$Notification {
  const factory Notification({
    required String uri,
    required String cid,
    required Profile author,
    required Map<String, dynamic> record,
    required String reason,
    Gallery? reasonSubjectGallery,
    Profile? reasonSubjectProfile,
    Comment? reasonSubjectComment,
    required bool isRead,
    required String indexedAt,
  }) = _Notification;

  factory Notification.fromJson(Map<String, dynamic> json) => _$NotificationFromJson(json);
}
