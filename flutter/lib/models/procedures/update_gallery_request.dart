import 'package:freezed_annotation/freezed_annotation.dart';

part 'update_gallery_request.freezed.dart';
part 'update_gallery_request.g.dart';

/// Request model for updating a gallery.
/// See lexicon: social.grain.gallery.updateGallery
@freezed
class UpdateGalleryRequest with _$UpdateGalleryRequest {
  const factory UpdateGalleryRequest({
    required String galleryUri,
    required String title,
    String? description,
  }) = _UpdateGalleryRequest;

  factory UpdateGalleryRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateGalleryRequestFromJson(json);
}
