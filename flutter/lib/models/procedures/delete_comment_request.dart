import 'package:freezed_annotation/freezed_annotation.dart';

part 'delete_comment_request.freezed.dart';
part 'delete_comment_request.g.dart';

/// Request model for deleting a comment.
/// See lexicon: social.grain.comment.deleteComment
@freezed
class DeleteCommentRequest with _$DeleteCommentRequest {
  const factory DeleteCommentRequest({required String uri}) = _DeleteCommentRequest;

  factory DeleteCommentRequest.fromJson(Map<String, dynamic> json) =>
      _$DeleteCommentRequestFromJson(json);
}
