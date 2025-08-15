import 'package:freezed_annotation/freezed_annotation.dart';

import 'gallery.dart';
import 'profile.dart';

part 'profile_with_galleries.freezed.dart';
part 'profile_with_galleries.g.dart';

@freezed
class ProfileWithGalleries with _$ProfileWithGalleries {
  const factory ProfileWithGalleries({
    required Profile profile,
    required List<Gallery> galleries,
    List<Gallery>? favs,
  }) = _ProfileWithGalleries;

  factory ProfileWithGalleries.fromJson(Map<String, dynamic> json) =>
      _$ProfileWithGalleriesFromJson(json);
}
