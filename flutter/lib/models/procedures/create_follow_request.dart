import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_follow_request.freezed.dart';
part 'create_follow_request.g.dart';

/// Request model for creating a follow relationship.
///
/// [subject] - The actor DID to follow.
@freezed
class CreateFollowRequest with _$CreateFollowRequest {
  const factory CreateFollowRequest({required String subject}) = _CreateFollowRequest;

  factory CreateFollowRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateFollowRequestFromJson(json);
}
