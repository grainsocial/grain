import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:grain/models/gallery.dart';
import 'package:grain/models/profile.dart';

import 'gallery_photo.dart';

part 'comment.freezed.dart';
part 'comment.g.dart';

@freezed
class Comment with _$Comment {
  const factory Comment({
    required String uri,
    required String cid,
    required Profile author,
    required String text,
    required Gallery subject,
    String? replyTo,
    String? createdAt,
    GalleryPhoto? focus,
    List<Map<String, dynamic>>? facets,
  }) = _Comment;

  factory Comment.fromJson(Map<String, dynamic> json) => _$CommentFromJson(json);
}
