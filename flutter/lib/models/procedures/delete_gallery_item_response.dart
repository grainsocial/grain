import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_gallery_item_response.freezed.dart';
part 'delete_gallery_item_response.g.dart';

/// Response model for deleting a gallery item.
/// See lexicon: social.grain.gallery.deleteItem
@freezed
class DeleteGalleryItemResponse with _$DeleteGalleryItemResponse {
  const factory DeleteGalleryItemResponse({required bool success}) = _DeleteGalleryItemResponse;

  factory DeleteGalleryItemResponse.fromJson(Map<String, dynamic> json) =>
      _$DeleteGalleryItemResponseFromJson(json);
}
