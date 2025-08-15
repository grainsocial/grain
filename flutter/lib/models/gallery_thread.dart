import 'package:freezed_annotation/freezed_annotation.dart';

import 'comment.dart';
import 'gallery.dart';

part 'gallery_thread.freezed.dart';
part 'gallery_thread.g.dart';

@freezed
class GalleryThread with _$GalleryThread {
  const factory GalleryThread({required Gallery gallery, required List<Comment> comments}) =
      _GalleryThread;

  factory GalleryThread.fromJson(Map<String, dynamic> json) => _$GalleryThreadFromJson(json);
}
