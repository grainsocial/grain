import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_gallery_request.freezed.dart';
part 'delete_gallery_request.g.dart';

/// Request model for deleting a gallery.
/// See lexicon: social.grain.gallery.deleteGallery
@freezed
class DeleteGalleryRequest with _$DeleteGalleryRequest {
  const factory DeleteGalleryRequest({required String uri}) = _DeleteGalleryRequest;

  factory DeleteGalleryRequest.fromJson(Map<String, dynamic> json) =>
      _$DeleteGalleryRequestFromJson(json);
}
