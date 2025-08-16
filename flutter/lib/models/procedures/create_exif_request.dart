import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_exif_request.freezed.dart';
part 'create_exif_request.g.dart';

/// Request model for creating a new Exif record for a photo.
@freezed
class CreateExifRequest with _$CreateExifRequest {
  const factory CreateExifRequest({
    required String photo,
    String? dateTimeOriginal,
    int? exposureTime,
    int? fNumber,
    String? flash,
    int? focalLengthIn35mmFormat,
    int? iSO,
    String? lensMake,
    String? lensModel,
    String? make,
    String? model,
  }) = _CreateExifRequest;

  factory CreateExifRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateExifRequestFromJson(json);
}
