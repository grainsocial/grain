import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_exif_response.freezed.dart';
part 'create_exif_response.g.dart';

/// Response model for creating a new Exif record for a photo.
///
/// [exifUri] - The URI of the created Exif record.
@freezed
class CreateExifResponse with _$CreateExifResponse {
  const factory CreateExifResponse({required String exifUri}) = _CreateExifResponse;

  factory CreateExifResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateExifResponseFromJson(json);
}
