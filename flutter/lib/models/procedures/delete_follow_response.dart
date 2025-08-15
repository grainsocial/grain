import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_follow_response.freezed.dart';
part 'delete_follow_response.g.dart';

/// Response model for deleting a follow relationship.
///
/// [success] - Indicates if the deletion was successful.
@freezed
class DeleteFollowResponse with _$DeleteFollowResponse {
  const factory DeleteFollowResponse({required bool success}) = _DeleteFollowResponse;

  factory DeleteFollowResponse.fromJson(Map<String, dynamic> json) =>
      _$DeleteFollowResponseFromJson(json);
}
