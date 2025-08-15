// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_exif_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CreateExifRequestImpl _$$CreateExifRequestImplFromJson(
  Map<String, dynamic> json,
) => _$CreateExifRequestImpl(
  photo: json['photo'] as String,
  dateTimeOriginal: json['dateTimeOriginal'] as String?,
  exposureTime: (json['exposureTime'] as num?)?.toInt(),
  fNumber: (json['fNumber'] as num?)?.toInt(),
  flash: json['flash'] as String?,
  focalLengthIn35mmFormat: (json['focalLengthIn35mmFormat'] as num?)?.toInt(),
  iSO: (json['iSO'] as num?)?.toInt(),
  lensMake: json['lensMake'] as String?,
  lensModel: json['lensModel'] as String?,
  make: json['make'] as String?,
  model: json['model'] as String?,
);

Map<String, dynamic> _$$CreateExifRequestImplToJson(
  _$CreateExifRequestImpl instance,
) => <String, dynamic>{
  'photo': instance.photo,
  'dateTimeOriginal': instance.dateTimeOriginal,
  'exposureTime': instance.exposureTime,
  'fNumber': instance.fNumber,
  'flash': instance.flash,
  'focalLengthIn35mmFormat': instance.focalLengthIn35mmFormat,
  'iSO': instance.iSO,
  'lensMake': instance.lensMake,
  'lensModel': instance.lensModel,
  'make': instance.make,
  'model': instance.model,
};
