import 'package:freezed_annotation/freezed_annotation.dart';

part 'apply_alts_update.freezed.dart';
part 'apply_alts_update.g.dart';

/// Update alt text for a photo in a gallery.
/// AT URI of the item to update and the alt text to apply.
@freezed
class ApplyAltsUpdate with _$ApplyAltsUpdate {
  const factory ApplyAltsUpdate({required String photoUri, required String alt}) = _ApplyAltsUpdate;

  factory ApplyAltsUpdate.fromJson(Map<String, dynamic> json) => _$ApplyAltsUpdateFromJson(json);
}
