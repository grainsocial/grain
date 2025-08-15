import 'package:freezed_annotation/freezed_annotation.dart';

import 'profile_viewer.dart';

part 'profile.freezed.dart';
part 'profile.g.dart';

@freezed
class Profile with _$Profile {
  const factory Profile({
    required String cid,
    required String did,
    required String handle,
    String? displayName,
    String? description,
    String? avatar,
    int? followersCount,
    int? followsCount,
    int? galleryCount,
    ProfileViewer? viewer,
    List<String>? cameras,
    // Added field for description facets used on profile page
    List<Map<String, dynamic>>? descriptionFacets,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);
}
