import 'package:freezed_annotation/freezed_annotation.dart';

part 'apply_alts_response.freezed.dart';
part 'apply_alts_response.g.dart';

/// Response for applyAlts API.
/// True if the writes were successfully applied.
@freezed
class ApplyAltsResponse with _$ApplyAltsResponse {
  const factory ApplyAltsResponse({required bool success}) = _ApplyAltsResponse;

  factory ApplyAltsResponse.fromJson(Map<String, dynamic> json) =>
      _$ApplyAltsResponseFromJson(json);
}
