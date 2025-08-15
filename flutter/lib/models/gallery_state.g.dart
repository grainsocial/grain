// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GalleryStateImpl _$$GalleryStateImplFromJson(Map<String, dynamic> json) =>
    _$GalleryStateImpl(
      item: json['item'] as String,
      itemCreatedAt: json['itemCreatedAt'] as String,
      itemPosition: (json['itemPosition'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$GalleryStateImplToJson(_$GalleryStateImpl instance) =>
    <String, dynamic>{
      'item': instance.item,
      'itemCreatedAt': instance.itemCreatedAt,
      'itemPosition': instance.itemPosition,
    };
