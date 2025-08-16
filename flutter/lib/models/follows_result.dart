import 'package:freezed_annotation/freezed_annotation.dart';

import 'profile.dart';

part 'follows_result.freezed.dart';
part 'follows_result.g.dart';

@freezed
class FollowsResult with _$FollowsResult {
  const factory FollowsResult({
    required dynamic subject,
    required List<Profile> follows,
    String? cursor,
  }) = _FollowsResult;

  factory FollowsResult.fromJson(Map<String, dynamic> json) => FollowsResult(
    subject: json['subject'],
    follows: (json['follows'] as List<dynamic>?)?.map((e) => Profile.fromJson(e)).toList() ?? [],
    cursor: json['cursor'],
  );
}
