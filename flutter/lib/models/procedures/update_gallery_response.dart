import 'package:freezed_annotation/freezed_annotation.dart';

part 'update_gallery_response.freezed.dart';
part 'update_gallery_response.g.dart';

/// Response model for updating a gallery.
/// See lexicon: social.grain.gallery.updateGallery
@freezed
class UpdateGalleryResponse with _$UpdateGalleryResponse {
  const factory UpdateGalleryResponse({required bool success}) = _UpdateGalleryResponse;

  factory UpdateGalleryResponse.fromJson(Map<String, dynamic> json) =>
      _$UpdateGalleryResponseFromJson(json);
}
