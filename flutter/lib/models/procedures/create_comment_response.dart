import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_comment_response.freezed.dart';
part 'create_comment_response.g.dart';

/// Response model for creating a comment.
/// See lexicon: social.grain.comment.createComment
@freezed
class CreateCommentResponse with _$CreateCommentResponse {
  const factory CreateCommentResponse({required String commentUri}) = _CreateCommentResponse;

  factory CreateCommentResponse.fromJson(Map<String, dynamic> json) =>
      _$CreateCommentResponseFromJson(json);
}
