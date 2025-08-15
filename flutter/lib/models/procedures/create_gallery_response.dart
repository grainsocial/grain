import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_gallery_response.freezed.dart';
part 'create_gallery_response.g.dart';

/// Response model for creating a gallery.
/// See lexicon: social.grain.gallery.createGallery
@freezed
class CreateGalleryResponse with _$CreateGalleryResponse {
  const factory CreateGalleryResponse({required String galleryUri}) = _CreateGalleryResponse;

  factory CreateGalleryResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateGalleryResponseFromJson(json);
}
