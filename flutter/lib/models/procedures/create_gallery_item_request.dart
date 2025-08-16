import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_gallery_item_request.freezed.dart';
part 'create_gallery_item_request.g.dart';

/// Request model for creating a gallery item.
/// See lexicon: social.grain.gallery.createItem
@freezed
class CreateGalleryItemRequest with _$CreateGalleryItemRequest {
  const factory CreateGalleryItemRequest({
    required String galleryUri,
    required String photoUri,
    required int position,
  }) = _CreateGalleryItemRequest;

  factory CreateGalleryItemRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateGalleryItemRequestFromJson(json);
}
