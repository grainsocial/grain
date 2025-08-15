// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'apply_alts_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ApplyAltsRequestImpl _$$ApplyAltsRequestImplFromJson(
  Map<String, dynamic> json,
) => _$ApplyAltsRequestImpl(
  writes: (json['writes'] as List<dynamic>)
      .map((e) => ApplyAltsUpdate.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$$ApplyAltsRequestImplToJson(
  _$ApplyAltsRequestImpl instance,
) => <String, dynamic>{'writes': instance.writes};
