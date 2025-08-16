// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GalleryImpl _$$GalleryImplFromJson(Map<String, dynamic> json) =>
    _$GalleryImpl(
      uri: json['uri'] as String,
      cid: json['cid'] as String,
      title: json['title'] as String?,
      description: json['description'] as String?,
      items: (json['items'] as List<dynamic>)
          .map((e) => GalleryPhoto.fromJson(e as Map<String, dynamic>))
          .toList(),
      creator: json['creator'] == null
          ? null
          : Profile.fromJson(json['creator'] as Map<String, dynamic>),
      createdAt: json['createdAt'] as String?,
      favCount: (json['favCount'] as num?)?.toInt(),
      commentCount: (json['commentCount'] as num?)?.toInt(),
      viewer: json['viewer'] == null
          ? null
          : GalleryViewer.fromJson(json['viewer'] as Map<String, dynamic>),
      facets: (json['facets'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList(),
      cameras: (json['cameras'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$$GalleryImplToJson(_$GalleryImpl instance) =>
    <String, dynamic>{
      'uri': instance.uri,
      'cid': instance.cid,
      'title': instance.title,
      'description': instance.description,
      'items': instance.items,
      'creator': instance.creator,
      'createdAt': instance.createdAt,
      'favCount': instance.favCount,
      'commentCount': instance.commentCount,
      'viewer': instance.viewer,
      'facets': instance.facets,
      'cameras': instance.cameras,
    };
