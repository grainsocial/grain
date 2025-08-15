import 'package:freezed_annotation/freezed_annotation.dart';

part 'profile_viewer.freezed.dart';
part 'profile_viewer.g.dart';

@freezed
class ProfileViewer with _$ProfileViewer {
  const factory ProfileViewer({String? following, String? followedBy}) = _ProfileViewer;

  factory ProfileViewer.fromJson(Map<String, dynamic> json) => _$ProfileViewerFromJson(json);
}
