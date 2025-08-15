import 'package:json_annotation/json_annotation.dart';

part 'apply_sort_response.g.dart';

@JsonSerializable()
class ApplySortResponse {
  final bool success;

  ApplySortResponse({required this.success});

  factory ApplySortResponse.fromJson(Map<String, dynamic> json) =>
      _$ApplySortResponseFromJson(json);
  Map<String, dynamic> toJson() => _$ApplySortResponseToJson(this);
}
