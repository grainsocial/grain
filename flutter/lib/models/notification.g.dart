// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$NotificationImpl _$$NotificationImplFromJson(
  Map<String, dynamic> json,
) => _$NotificationImpl(
  uri: json['uri'] as String,
  cid: json['cid'] as String,
  author: Profile.fromJson(json['author'] as Map<String, dynamic>),
  record: json['record'] as Map<String, dynamic>,
  reason: json['reason'] as String,
  reasonSubjectGallery: json['reasonSubjectGallery'] == null
      ? null
      : Gallery.fromJson(json['reasonSubjectGallery'] as Map<String, dynamic>),
  reasonSubjectProfile: json['reasonSubjectProfile'] == null
      ? null
      : Profile.fromJson(json['reasonSubjectProfile'] as Map<String, dynamic>),
  reasonSubjectComment: json['reasonSubjectComment'] == null
      ? null
      : Comment.fromJson(json['reasonSubjectComment'] as Map<String, dynamic>),
  isRead: json['isRead'] as bool,
  indexedAt: json['indexedAt'] as String,
);

Map<String, dynamic> _$$NotificationImplToJson(_$NotificationImpl instance) =>
    <String, dynamic>{
      'uri': instance.uri,
      'cid': instance.cid,
      'author': instance.author,
      'record': instance.record,
      'reason': instance.reason,
      'reasonSubjectGallery': instance.reasonSubjectGallery,
      'reasonSubjectProfile': instance.reasonSubjectProfile,
      'reasonSubjectComment': instance.reasonSubjectComment,
      'isRead': instance.isRead,
      'indexedAt': instance.indexedAt,
    };
