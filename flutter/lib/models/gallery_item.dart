import 'package:freezed_annotation/freezed_annotation.dart';

part 'gallery_item.freezed.dart';
part 'gallery_item.g.dart';

@freezed
class GalleryItem with _$GalleryItem {
  const factory GalleryItem({
    required String uri,
    required String gallery,
    required String item,
    required String createdAt,
    required int position,
  }) = _GalleryItem;

  factory GalleryItem.fromJson(Map<String, dynamic> json) => _$GalleryItemFromJson(json);
}
