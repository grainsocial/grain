// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'follows_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$FollowsResultImpl _$$FollowsResultImplFromJson(Map<String, dynamic> json) =>
    _$FollowsResultImpl(
      subject: json['subject'],
      follows: (json['follows'] as List<dynamic>)
          .map((e) => Profile.fromJson(e as Map<String, dynamic>))
          .toList(),
      cursor: json['cursor'] as String?,
    );

Map<String, dynamic> _$$FollowsResultImplToJson(_$FollowsResultImpl instance) =>
    <String, dynamic>{
      'subject': instance.subject,
      'follows': instance.follows,
      'cursor': instance.cursor,
    };
