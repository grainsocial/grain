// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_thread.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GalleryThreadImpl _$$GalleryThreadImplFromJson(Map<String, dynamic> json) =>
    _$GalleryThreadImpl(
      gallery: Gallery.fromJson(json['gallery'] as Map<String, dynamic>),
      comments: (json['comments'] as List<dynamic>)
          .map((e) => Comment.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$GalleryThreadImplToJson(_$GalleryThreadImpl instance) =>
    <String, dynamic>{
      'gallery': instance.gallery,
      'comments': instance.comments,
    };
