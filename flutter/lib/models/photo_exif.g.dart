// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'photo_exif.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PhotoExifImpl _$$PhotoExifImplFromJson(Map<String, dynamic> json) =>
    _$PhotoExifImpl(
      photo: json['photo'] as String,
      createdAt: json['createdAt'] as String,
      uri: json['uri'] as String?,
      cid: json['cid'] as String?,
      dateTimeOriginal: json['dateTimeOriginal'] as String?,
      exposureTime: json['exposureTime'] as String?,
      fNumber: json['fNumber'] as String?,
      flash: json['flash'] as String?,
      focalLengthIn35mmFormat: json['focalLengthIn35mmFormat'] as String?,
      iSO: (json['iSO'] as num?)?.toInt(),
      lensMake: json['lensMake'] as String?,
      lensModel: json['lensModel'] as String?,
      make: json['make'] as String?,
      model: json['model'] as String?,
      record: json['record'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$PhotoExifImplToJson(_$PhotoExifImpl instance) =>
    <String, dynamic>{
      'photo': instance.photo,
      'createdAt': instance.createdAt,
      'uri': instance.uri,
      'cid': instance.cid,
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
      'record': instance.record,
    };
