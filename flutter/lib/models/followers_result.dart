import 'package:freezed_annotation/freezed_annotation.dart';

import 'profile.dart';

part 'followers_result.freezed.dart';
part 'followers_result.g.dart';

@freezed
class FollowersResult with _$FollowersResult {
  const factory FollowersResult({
    required dynamic subject,
    required List<Profile> followers,
    String? cursor,
  }) = _FollowersResult;

  factory FollowersResult.fromJson(Map<String, dynamic> json) => FollowersResult(
    subject: json['subject'],
    followers:
        (json['followers'] as List<dynamic>?)?.map((e) => Profile.fromJson(e)).toList() ?? [],
    cursor: json['cursor'],
  );
}
