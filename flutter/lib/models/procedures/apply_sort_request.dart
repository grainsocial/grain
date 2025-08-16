import 'package:json_annotation/json_annotation.dart';

part 'apply_sort_request.g.dart';

@JsonSerializable()
class ApplySortRequest {
  final List<ApplySortUpdate> writes;

  ApplySortRequest({required this.writes});

  factory ApplySortRequest.fromJson(Map<String, dynamic> json) => _$ApplySortRequestFromJson(json);
  Map<String, dynamic> toJson() => _$ApplySortRequestToJson(this);
}

@JsonSerializable()
class ApplySortUpdate {
  final String itemUri;
  final int position;

  ApplySortUpdate({required this.itemUri, required this.position});

  factory ApplySortUpdate.fromJson(Map<String, dynamic> json) => _$ApplySortUpdateFromJson(json);
  Map<String, dynamic> toJson() => _$ApplySortUpdateToJson(this);
}
