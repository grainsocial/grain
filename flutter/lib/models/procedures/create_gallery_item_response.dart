import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_gallery_item_response.freezed.dart';
part 'create_gallery_item_response.g.dart';

/// Response model for creating a gallery item.
/// See lexicon: social.grain.gallery.createItem
@freezed
class CreateGalleryItemResponse with _$CreateGalleryItemResponse {
  const factory CreateGalleryItemResponse({required String itemUri}) = _CreateGalleryItemResponse;

  factory CreateGalleryItemResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateGalleryItemResponseFromJson(json);
}
