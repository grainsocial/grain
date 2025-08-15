// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'comment.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Comment _$CommentFromJson(Map<String, dynamic> json) {
  return _Comment.fromJson(json);
}

/// @nodoc
mixin _$Comment {
  String get uri => throw _privateConstructorUsedError;
  String get cid => throw _privateConstructorUsedError;
  Profile get author => throw _privateConstructorUsedError;
  String get text => throw _privateConstructorUsedError;
  Gallery get subject => throw _privateConstructorUsedError;
  String? get replyTo => throw _privateConstructorUsedError;
  String? get createdAt => throw _privateConstructorUsedError;
  GalleryPhoto? get focus => throw _privateConstructorUsedError;
  List<Map<String, dynamic>>? get facets => throw _privateConstructorUsedError;

  /// Serializes this Comment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CommentCopyWith<Comment> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CommentCopyWith<$Res> {
  factory $CommentCopyWith(Comment value, $Res Function(Comment) then) =
      _$CommentCopyWithImpl<$Res, Comment>;
  @useResult
  $Res call({
    String uri,
    String cid,
    Profile author,
    String text,
    Gallery subject,
    String? replyTo,
    String? createdAt,
    GalleryPhoto? focus,
    List<Map<String, dynamic>>? facets,
  });

  $ProfileCopyWith<$Res> get author;
  $GalleryCopyWith<$Res> get subject;
  $GalleryPhotoCopyWith<$Res>? get focus;
}

/// @nodoc
class _$CommentCopyWithImpl<$Res, $Val extends Comment>
    implements $CommentCopyWith<$Res> {
  _$CommentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? author = null,
    Object? text = null,
    Object? subject = null,
    Object? replyTo = freezed,
    Object? createdAt = freezed,
    Object? focus = freezed,
    Object? facets = freezed,
  }) {
    return _then(
      _value.copyWith(
            uri: null == uri
                ? _value.uri
                : uri // ignore: cast_nullable_to_non_nullable
                      as String,
            cid: null == cid
                ? _value.cid
                : cid // ignore: cast_nullable_to_non_nullable
                      as String,
            author: null == author
                ? _value.author
                : author // ignore: cast_nullable_to_non_nullable
                      as Profile,
            text: null == text
                ? _value.text
                : text // ignore: cast_nullable_to_non_nullable
                      as String,
            subject: null == subject
                ? _value.subject
                : subject // ignore: cast_nullable_to_non_nullable
                      as Gallery,
            replyTo: freezed == replyTo
                ? _value.replyTo
                : replyTo // ignore: cast_nullable_to_non_nullable
                      as String?,
            createdAt: freezed == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as String?,
            focus: freezed == focus
                ? _value.focus
                : focus // ignore: cast_nullable_to_non_nullable
                      as GalleryPhoto?,
            facets: freezed == facets
                ? _value.facets
                : facets // ignore: cast_nullable_to_non_nullable
                      as List<Map<String, dynamic>>?,
          )
          as $Val,
    );
  }

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileCopyWith<$Res> get author {
    return $ProfileCopyWith<$Res>(_value.author, (value) {
      return _then(_value.copyWith(author: value) as $Val);
    });
  }

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryCopyWith<$Res> get subject {
    return $GalleryCopyWith<$Res>(_value.subject, (value) {
      return _then(_value.copyWith(subject: value) as $Val);
    });
  }

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryPhotoCopyWith<$Res>? get focus {
    if (_value.focus == null) {
      return null;
    }

    return $GalleryPhotoCopyWith<$Res>(_value.focus!, (value) {
      return _then(_value.copyWith(focus: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CommentImplCopyWith<$Res> implements $CommentCopyWith<$Res> {
  factory _$$CommentImplCopyWith(
    _$CommentImpl value,
    $Res Function(_$CommentImpl) then,
  ) = __$$CommentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String uri,
    String cid,
    Profile author,
    String text,
    Gallery subject,
    String? replyTo,
    String? createdAt,
    GalleryPhoto? focus,
    List<Map<String, dynamic>>? facets,
  });

  @override
  $ProfileCopyWith<$Res> get author;
  @override
  $GalleryCopyWith<$Res> get subject;
  @override
  $GalleryPhotoCopyWith<$Res>? get focus;
}

/// @nodoc
class __$$CommentImplCopyWithImpl<$Res>
    extends _$CommentCopyWithImpl<$Res, _$CommentImpl>
    implements _$$CommentImplCopyWith<$Res> {
  __$$CommentImplCopyWithImpl(
    _$CommentImpl _value,
    $Res Function(_$CommentImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? author = null,
    Object? text = null,
    Object? subject = null,
    Object? replyTo = freezed,
    Object? createdAt = freezed,
    Object? focus = freezed,
    Object? facets = freezed,
  }) {
    return _then(
      _$CommentImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
        cid: null == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String,
        author: null == author
            ? _value.author
            : author // ignore: cast_nullable_to_non_nullable
                  as Profile,
        text: null == text
            ? _value.text
            : text // ignore: cast_nullable_to_non_nullable
                  as String,
        subject: null == subject
            ? _value.subject
            : subject // ignore: cast_nullable_to_non_nullable
                  as Gallery,
        replyTo: freezed == replyTo
            ? _value.replyTo
            : replyTo // ignore: cast_nullable_to_non_nullable
                  as String?,
        createdAt: freezed == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as String?,
        focus: freezed == focus
            ? _value.focus
            : focus // ignore: cast_nullable_to_non_nullable
                  as GalleryPhoto?,
        facets: freezed == facets
            ? _value._facets
            : facets // ignore: cast_nullable_to_non_nullable
                  as List<Map<String, dynamic>>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CommentImpl implements _Comment {
  const _$CommentImpl({
    required this.uri,
    required this.cid,
    required this.author,
    required this.text,
    required this.subject,
    this.replyTo,
    this.createdAt,
    this.focus,
    final List<Map<String, dynamic>>? facets,
  }) : _facets = facets;

  factory _$CommentImpl.fromJson(Map<String, dynamic> json) =>
      _$$CommentImplFromJson(json);

  @override
  final String uri;
  @override
  final String cid;
  @override
  final Profile author;
  @override
  final String text;
  @override
  final Gallery subject;
  @override
  final String? replyTo;
  @override
  final String? createdAt;
  @override
  final GalleryPhoto? focus;
  final List<Map<String, dynamic>>? _facets;
  @override
  List<Map<String, dynamic>>? get facets {
    final value = _facets;
    if (value == null) return null;
    if (_facets is EqualUnmodifiableListView) return _facets;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'Comment(uri: $uri, cid: $cid, author: $author, text: $text, subject: $subject, replyTo: $replyTo, createdAt: $createdAt, focus: $focus, facets: $facets)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CommentImpl &&
            (identical(other.uri, uri) || other.uri == uri) &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.author, author) || other.author == author) &&
            (identical(other.text, text) || other.text == text) &&
            (identical(other.subject, subject) || other.subject == subject) &&
            (identical(other.replyTo, replyTo) || other.replyTo == replyTo) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.focus, focus) || other.focus == focus) &&
            const DeepCollectionEquality().equals(other._facets, _facets));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    uri,
    cid,
    author,
    text,
    subject,
    replyTo,
    createdAt,
    focus,
    const DeepCollectionEquality().hash(_facets),
  );

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CommentImplCopyWith<_$CommentImpl> get copyWith =>
      __$$CommentImplCopyWithImpl<_$CommentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CommentImplToJson(this);
  }
}

abstract class _Comment implements Comment {
  const factory _Comment({
    required final String uri,
    required final String cid,
    required final Profile author,
    required final String text,
    required final Gallery subject,
    final String? replyTo,
    final String? createdAt,
    final GalleryPhoto? focus,
    final List<Map<String, dynamic>>? facets,
  }) = _$CommentImpl;

  factory _Comment.fromJson(Map<String, dynamic> json) = _$CommentImpl.fromJson;

  @override
  String get uri;
  @override
  String get cid;
  @override
  Profile get author;
  @override
  String get text;
  @override
  Gallery get subject;
  @override
  String? get replyTo;
  @override
  String? get createdAt;
  @override
  GalleryPhoto? get focus;
  @override
  List<Map<String, dynamic>>? get facets;

  /// Create a copy of Comment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CommentImplCopyWith<_$CommentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
