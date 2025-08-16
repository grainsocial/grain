import 'package:freezed_annotation/freezed_annotation.dart';

import 'apply_alts_update.dart';

part 'apply_alts_request.freezed.dart';
part 'apply_alts_request.g.dart';

/// Request to apply alt texts to photos in a gallery.
/// Requires auth.
@freezed
class ApplyAltsRequest with _$ApplyAltsRequest {
  const factory ApplyAltsRequest({required List<ApplyAltsUpdate> writes}) = _ApplyAltsRequest;

  factory ApplyAltsRequest.fromJson(Map<String, dynamic> json) => _$ApplyAltsRequestFromJson(json);
}
