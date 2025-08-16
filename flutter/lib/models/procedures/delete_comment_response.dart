import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_comment_response.freezed.dart';
part 'delete_comment_response.g.dart';

/// Response model for deleting a comment.
/// See lexicon: social.grain.comment.deleteComment
@freezed
class DeleteCommentResponse with _$DeleteCommentResponse {
  const factory DeleteCommentResponse({required bool success}) = _DeleteCommentResponse;

  factory DeleteCommentResponse.fromJson(Map<String, dynamic> json) =>
      _$DeleteCommentResponseFromJson(json);
}
