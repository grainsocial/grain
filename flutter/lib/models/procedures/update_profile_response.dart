import 'package:freezed_annotation/freezed_annotation.dart';

part 'update_profile_response.freezed.dart';
part 'update_profile_response.g.dart';

/// Response model for updating an actor's profile information.
///
/// [success] - Indicates if the update was successful.
@freezed
class UpdateProfileResponse with _$UpdateProfileResponse {
  const factory UpdateProfileResponse({required bool success}) = _UpdateProfileResponse;

  factory UpdateProfileResponse.fromJson(Map<String, dynamic> json) =>
      _$UpdateProfileResponseFromJson(json);
}
