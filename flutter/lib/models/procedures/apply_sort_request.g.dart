// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'apply_sort_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ApplySortRequest _$ApplySortRequestFromJson(Map<String, dynamic> json) =>
    ApplySortRequest(
      writes: (json['writes'] as List<dynamic>)
          .map((e) => ApplySortUpdate.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$ApplySortRequestToJson(ApplySortRequest instance) =>
    <String, dynamic>{'writes': instance.writes};

ApplySortUpdate _$ApplySortUpdateFromJson(Map<String, dynamic> json) =>
    ApplySortUpdate(
      itemUri: json['itemUri'] as String,
      position: (json['position'] as num).toInt(),
    );

Map<String, dynamic> _$ApplySortUpdateToJson(ApplySortUpdate instance) =>
    <String, dynamic>{
      'itemUri': instance.itemUri,
      'position': instance.position,
    };
