import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_gallery_response.freezed.dart';
part 'delete_gallery_response.g.dart';

/// Response model for deleting a gallery.
/// See lexicon: social.grain.gallery.deleteGallery
@freezed
class DeleteGalleryResponse with _$DeleteGalleryResponse {
  const factory DeleteGalleryResponse({required bool success}) = _DeleteGalleryResponse;

  factory DeleteGalleryResponse.fromJson(Map<String, dynamic> json) =>
      _$DeleteGalleryResponseFromJson(json);
}
