// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_gallery_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UpdateGalleryRequestImpl _$$UpdateGalleryRequestImplFromJson(
  Map<String, dynamic> json,
) => _$UpdateGalleryRequestImpl(
  galleryUri: json['galleryUri'] as String,
  title: json['title'] as String,
  description: json['description'] as String?,
);

Map<String, dynamic> _$$UpdateGalleryRequestImplToJson(
  _$UpdateGalleryRequestImpl instance,
) => <String, dynamic>{
  'galleryUri': instance.galleryUri,
  'title': instance.title,
  'description': instance.description,
};
