import 'package:freezed_annotation/freezed_annotation.dart';

part 'gallery_viewer.freezed.dart';
part 'gallery_viewer.g.dart';

@freezed
class GalleryViewer with _$GalleryViewer {
  const factory GalleryViewer({String? fav}) = _GalleryViewer;

  factory GalleryViewer.fromJson(Map<String, dynamic> json) => _$GalleryViewerFromJson(json);
}
