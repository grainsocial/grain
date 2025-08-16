// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_comment_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CreateCommentRequestImpl _$$CreateCommentRequestImplFromJson(
  Map<String, dynamic> json,
) => _$CreateCommentRequestImpl(
  text: json['text'] as String,
  subject: json['subject'] as String,
  focus: json['focus'] as String?,
  replyTo: json['replyTo'] as String?,
);

Map<String, dynamic> _$$CreateCommentRequestImplToJson(
  _$CreateCommentRequestImpl instance,
) => <String, dynamic>{
  'text': instance.text,
  'subject': instance.subject,
  'focus': instance.focus,
  'replyTo': instance.replyTo,
};
