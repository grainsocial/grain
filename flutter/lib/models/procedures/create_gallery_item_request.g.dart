// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_gallery_item_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CreateGalleryItemRequestImpl _$$CreateGalleryItemRequestImplFromJson(
  Map<String, dynamic> json,
) => _$CreateGalleryItemRequestImpl(
  galleryUri: json['galleryUri'] as String,
  photoUri: json['photoUri'] as String,
  position: (json['position'] as num).toInt(),
);

Map<String, dynamic> _$$CreateGalleryItemRequestImplToJson(
  _$CreateGalleryItemRequestImpl instance,
) => <String, dynamic>{
  'galleryUri': instance.galleryUri,
  'photoUri': instance.photoUri,
  'position': instance.position,
};
