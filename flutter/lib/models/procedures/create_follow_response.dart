import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_follow_response.freezed.dart';
part 'create_follow_response.g.dart';

/// Response model for creating a follow relationship.
///
/// [followUri] - The URI of the created follow relationship.
@freezed
class CreateFollowResponse with _$CreateFollowResponse {
  const factory CreateFollowResponse({required String followUri}) = _CreateFollowResponse;

  factory CreateFollowResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateFollowResponseFromJson(json);
}
