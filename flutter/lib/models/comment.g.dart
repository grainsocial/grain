// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'comment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CommentImpl _$$CommentImplFromJson(Map<String, dynamic> json) =>
    _$CommentImpl(
      uri: json['uri'] as String,
      cid: json['cid'] as String,
      author: Profile.fromJson(json['author'] as Map<String, dynamic>),
      text: json['text'] as String,
      subject: Gallery.fromJson(json['subject'] as Map<String, dynamic>),
      replyTo: json['replyTo'] as String?,
      createdAt: json['createdAt'] as String?,
      focus: json['focus'] == null
          ? null
          : GalleryPhoto.fromJson(json['focus'] as Map<String, dynamic>),
      facets: (json['facets'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList(),
    );

Map<String, dynamic> _$$CommentImplToJson(_$CommentImpl instance) =>
    <String, dynamic>{
      'uri': instance.uri,
      'cid': instance.cid,
      'author': instance.author,
      'text': instance.text,
      'subject': instance.subject,
      'replyTo': instance.replyTo,
      'createdAt': instance.createdAt,
      'focus': instance.focus,
      'facets': instance.facets,
    };
