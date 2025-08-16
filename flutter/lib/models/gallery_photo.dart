import 'package:freezed_annotation/freezed_annotation.dart';

import 'aspect_ratio.dart';
import 'gallery_state.dart';
import 'photo_exif.dart';

part 'gallery_photo.freezed.dart';
part 'gallery_photo.g.dart';

@freezed
class GalleryPhoto with _$GalleryPhoto {
  const factory GalleryPhoto({
    required String uri,
    required String cid,
    String? thumb,
    String? fullsize,
    String? alt,
    AspectRatio? aspectRatio,
    GalleryState? gallery,
    PhotoExif? exif,
  }) = _GalleryPhoto;

  factory GalleryPhoto.fromJson(Map<String, dynamic> json) => _$GalleryPhotoFromJson(json);
}
