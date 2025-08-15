import 'package:freezed_annotation/freezed_annotation.dart';

part 'update_avatar_response.freezed.dart';
part 'update_avatar_response.g.dart';

/// Response model for updating an actor's avatar image.
///
/// [success] - Indicates if the update was successful.
@freezed
class UpdateAvatarResponse with _$UpdateAvatarResponse {
  const factory UpdateAvatarResponse({required bool success}) = _UpdateAvatarResponse;

  factory UpdateAvatarResponse.fromJson(Map<String, dynamic> json) =>
      _$UpdateAvatarResponseFromJson(json);
}
