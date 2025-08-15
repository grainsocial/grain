import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_gallery_request.freezed.dart';
part 'create_gallery_request.g.dart';

/// Request model for creating a gallery.
/// See lexicon: social.grain.gallery.createGallery
@freezed
class CreateGalleryRequest with _$CreateGalleryRequest {
  const factory CreateGalleryRequest({required String title, String? description}) =
      _CreateGalleryRequest;

  factory CreateGalleryRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateGalleryRequestFromJson(json);
}
