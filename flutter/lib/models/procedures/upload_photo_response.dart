import 'package:freezed_annotation/freezed_annotation.dart';

part 'upload_photo_response.freezed.dart';
part 'upload_photo_response.g.dart';

/// Response model for uploading a photo.
/// See lexicon: social.grain.photo.uploadPhoto
@freezed
class UploadPhotoResponse with _$UploadPhotoResponse {
  const factory UploadPhotoResponse({required String photoUri}) = _UploadPhotoResponse;

  factory UploadPhotoResponse.fromJson(Map<String, dynamic> json) =>
      _$UploadPhotoResponseFromJson(json);
}
