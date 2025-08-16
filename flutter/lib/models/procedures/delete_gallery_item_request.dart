import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_gallery_item_request.freezed.dart';
part 'delete_gallery_item_request.g.dart';

/// Request model for deleting a gallery item.
/// See lexicon: social.grain.gallery.deleteItem
@freezed
class DeleteGalleryItemRequest with _$DeleteGalleryItemRequest {
  const factory DeleteGalleryItemRequest({required String uri}) = _DeleteGalleryItemRequest;

  factory DeleteGalleryItemRequest.fromJson(Map<String, dynamic> json) =>
      _$DeleteGalleryItemRequestFromJson(json);
}
