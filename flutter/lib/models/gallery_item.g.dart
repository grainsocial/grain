// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GalleryItemImpl _$$GalleryItemImplFromJson(Map<String, dynamic> json) =>
    _$GalleryItemImpl(
      uri: json['uri'] as String,
      gallery: json['gallery'] as String,
      item: json['item'] as String,
      createdAt: json['createdAt'] as String,
      position: (json['position'] as num).toInt(),
    );

Map<String, dynamic> _$$GalleryItemImplToJson(_$GalleryItemImpl instance) =>
    <String, dynamic>{
      'uri': instance.uri,
      'gallery': instance.gallery,
      'item': instance.item,
      'createdAt': instance.createdAt,
      'position': instance.position,
    };
