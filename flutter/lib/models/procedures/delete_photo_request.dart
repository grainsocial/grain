import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_photo_request.freezed.dart';
part 'delete_photo_request.g.dart';

/// Request model for deleting a photo.
/// See lexicon: social.grain.photo.deletePhoto
@freezed
class DeletePhotoRequest with _$DeletePhotoRequest {
  const factory DeletePhotoRequest({required String uri}) = _DeletePhotoRequest;

  factory DeletePhotoRequest.fromJson(Map<String, dynamic> json) =>
      _$DeletePhotoRequestFromJson(json);
}
