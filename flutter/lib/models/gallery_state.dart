import 'package:freezed_annotation/freezed_annotation.dart';

part 'gallery_state.freezed.dart';
part 'gallery_state.g.dart';

@freezed
class GalleryState with _$GalleryState {
  const factory GalleryState({
    required String item,
    required String itemCreatedAt,
    int? itemPosition,
  }) = _GalleryState;

  factory GalleryState.fromJson(Map<String, dynamic> json) => _$GalleryStateFromJson(json);
}
