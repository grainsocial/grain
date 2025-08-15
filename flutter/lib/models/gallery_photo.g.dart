// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_photo.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GalleryPhotoImpl _$$GalleryPhotoImplFromJson(Map<String, dynamic> json) =>
    _$GalleryPhotoImpl(
      uri: json['uri'] as String,
      cid: json['cid'] as String,
      thumb: json['thumb'] as String?,
      fullsize: json['fullsize'] as String?,
      alt: json['alt'] as String?,
      aspectRatio: json['aspectRatio'] == null
          ? null
          : AspectRatio.fromJson(json['aspectRatio'] as Map<String, dynamic>),
      gallery: json['gallery'] == null
          ? null
          : GalleryState.fromJson(json['gallery'] as Map<String, dynamic>),
      exif: json['exif'] == null
          ? null
          : PhotoExif.fromJson(json['exif'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$GalleryPhotoImplToJson(_$GalleryPhotoImpl instance) =>
    <String, dynamic>{
      'uri': instance.uri,
      'cid': instance.cid,
      'thumb': instance.thumb,
      'fullsize': instance.fullsize,
      'alt': instance.alt,
      'aspectRatio': instance.aspectRatio,
      'gallery': instance.gallery,
      'exif': instance.exif,
    };
