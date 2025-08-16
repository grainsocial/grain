import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_photo_response.freezed.dart';
part 'delete_photo_response.g.dart';

/// Response model for deleting a photo.
/// See lexicon: social.grain.photo.deletePhoto
@freezed
class DeletePhotoResponse with _$DeletePhotoResponse {
  const factory DeletePhotoResponse({required bool success}) = _DeletePhotoResponse;

  factory DeletePhotoResponse.fromJson(Map<String, dynamic> json) =>
      _$DeletePhotoResponseFromJson(json);
}
