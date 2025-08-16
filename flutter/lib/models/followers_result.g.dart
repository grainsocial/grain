// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'followers_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$FollowersResultImpl _$$FollowersResultImplFromJson(
  Map<String, dynamic> json,
) => _$FollowersResultImpl(
  subject: json['subject'],
  followers: (json['followers'] as List<dynamic>)
      .map((e) => Profile.fromJson(e as Map<String, dynamic>))
      .toList(),
  cursor: json['cursor'] as String?,
);

Map<String, dynamic> _$$FollowersResultImplToJson(
  _$FollowersResultImpl instance,
) => <String, dynamic>{
  'subject': instance.subject,
  'followers': instance.followers,
  'cursor': instance.cursor,
};
