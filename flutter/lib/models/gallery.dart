import 'package:freezed_annotation/freezed_annotation.dart';

import 'gallery_photo.dart';
import 'gallery_viewer.dart';
import 'profile.dart';

part 'gallery.freezed.dart';
part 'gallery.g.dart';

@freezed
class Gallery with _$Gallery {
  const factory Gallery({
    required String uri,
    required String cid,
    String? title,
    String? description,
    required List<GalleryPhoto> items,
    Profile? creator,
    String? createdAt,
    int? favCount,
    int? commentCount,
    GalleryViewer? viewer,
    List<Map<String, dynamic>>? facets,
    List<String>? cameras,
  }) = _Gallery;

  factory Gallery.fromJson(Map<String, dynamic> json) => _$GalleryFromJson(json);
}
