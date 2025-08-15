// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_with_galleries.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProfileWithGalleriesImpl _$$ProfileWithGalleriesImplFromJson(
  Map<String, dynamic> json,
) => _$ProfileWithGalleriesImpl(
  profile: Profile.fromJson(json['profile'] as Map<String, dynamic>),
  galleries: (json['galleries'] as List<dynamic>)
      .map((e) => Gallery.fromJson(e as Map<String, dynamic>))
      .toList(),
  favs: (json['favs'] as List<dynamic>?)
      ?.map((e) => Gallery.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$$ProfileWithGalleriesImplToJson(
  _$ProfileWithGalleriesImpl instance,
) => <String, dynamic>{
  'profile': instance.profile,
  'galleries': instance.galleries,
  'favs': instance.favs,
};
