import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_follow_request.freezed.dart';
part 'delete_follow_request.g.dart';

/// Request model for deleting a follow relationship.
///
/// [uri] - The URI of the follow relationship to delete.
@freezed
class DeleteFollowRequest with _$DeleteFollowRequest {
  const factory DeleteFollowRequest({required String uri}) = _DeleteFollowRequest;

  factory DeleteFollowRequest.fromJson(Map<String, dynamic> json) =>
      _$DeleteFollowRequestFromJson(json);
}
