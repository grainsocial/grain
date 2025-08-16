// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProfileImpl _$$ProfileImplFromJson(Map<String, dynamic> json) =>
    _$ProfileImpl(
      cid: json['cid'] as String,
      did: json['did'] as String,
      handle: json['handle'] as String,
      displayName: json['displayName'] as String?,
      description: json['description'] as String?,
      avatar: json['avatar'] as String?,
      followersCount: (json['followersCount'] as num?)?.toInt(),
      followsCount: (json['followsCount'] as num?)?.toInt(),
      galleryCount: (json['galleryCount'] as num?)?.toInt(),
      viewer: json['viewer'] == null
          ? null
          : ProfileViewer.fromJson(json['viewer'] as Map<String, dynamic>),
      cameras: (json['cameras'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      descriptionFacets: (json['descriptionFacets'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList(),
    );

Map<String, dynamic> _$$ProfileImplToJson(_$ProfileImpl instance) =>
    <String, dynamic>{
      'cid': instance.cid,
      'did': instance.did,
      'handle': instance.handle,
      'displayName': instance.displayName,
      'description': instance.description,
      'avatar': instance.avatar,
      'followersCount': instance.followersCount,
      'followsCount': instance.followsCount,
      'galleryCount': instance.galleryCount,
      'viewer': instance.viewer,
      'cameras': instance.cameras,
      'descriptionFacets': instance.descriptionFacets,
    };
