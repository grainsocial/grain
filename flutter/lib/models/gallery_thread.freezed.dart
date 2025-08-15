// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gallery_thread.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GalleryThread _$GalleryThreadFromJson(Map<String, dynamic> json) {
  return _GalleryThread.fromJson(json);
}

/// @nodoc
mixin _$GalleryThread {
  Gallery get gallery => throw _privateConstructorUsedError;
  List<Comment> get comments => throw _privateConstructorUsedError;

  /// Serializes this GalleryThread to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GalleryThreadCopyWith<GalleryThread> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GalleryThreadCopyWith<$Res> {
  factory $GalleryThreadCopyWith(
    GalleryThread value,
    $Res Function(GalleryThread) then,
  ) = _$GalleryThreadCopyWithImpl<$Res, GalleryThread>;
  @useResult
  $Res call({Gallery gallery, List<Comment> comments});

  $GalleryCopyWith<$Res> get gallery;
}

/// @nodoc
class _$GalleryThreadCopyWithImpl<$Res, $Val extends GalleryThread>
    implements $GalleryThreadCopyWith<$Res> {
  _$GalleryThreadCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? gallery = null, Object? comments = null}) {
    return _then(
      _value.copyWith(
            gallery: null == gallery
                ? _value.gallery
                : gallery // ignore: cast_nullable_to_non_nullable
                      as Gallery,
            comments: null == comments
                ? _value.comments
                : comments // ignore: cast_nullable_to_non_nullable
                      as List<Comment>,
          )
          as $Val,
    );
  }

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryCopyWith<$Res> get gallery {
    return $GalleryCopyWith<$Res>(_value.gallery, (value) {
      return _then(_value.copyWith(gallery: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$GalleryThreadImplCopyWith<$Res>
    implements $GalleryThreadCopyWith<$Res> {
  factory _$$GalleryThreadImplCopyWith(
    _$GalleryThreadImpl value,
    $Res Function(_$GalleryThreadImpl) then,
  ) = __$$GalleryThreadImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({Gallery gallery, List<Comment> comments});

  @override
  $GalleryCopyWith<$Res> get gallery;
}

/// @nodoc
class __$$GalleryThreadImplCopyWithImpl<$Res>
    extends _$GalleryThreadCopyWithImpl<$Res, _$GalleryThreadImpl>
    implements _$$GalleryThreadImplCopyWith<$Res> {
  __$$GalleryThreadImplCopyWithImpl(
    _$GalleryThreadImpl _value,
    $Res Function(_$GalleryThreadImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? gallery = null, Object? comments = null}) {
    return _then(
      _$GalleryThreadImpl(
        gallery: null == gallery
            ? _value.gallery
            : gallery // ignore: cast_nullable_to_non_nullable
                  as Gallery,
        comments: null == comments
            ? _value._comments
            : comments // ignore: cast_nullable_to_non_nullable
                  as List<Comment>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GalleryThreadImpl implements _GalleryThread {
  const _$GalleryThreadImpl({
    required this.gallery,
    required final List<Comment> comments,
  }) : _comments = comments;

  factory _$GalleryThreadImpl.fromJson(Map<String, dynamic> json) =>
      _$$GalleryThreadImplFromJson(json);

  @override
  final Gallery gallery;
  final List<Comment> _comments;
  @override
  List<Comment> get comments {
    if (_comments is EqualUnmodifiableListView) return _comments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_comments);
  }

  @override
  String toString() {
    return 'GalleryThread(gallery: $gallery, comments: $comments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GalleryThreadImpl &&
            (identical(other.gallery, gallery) || other.gallery == gallery) &&
            const DeepCollectionEquality().equals(other._comments, _comments));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    gallery,
    const DeepCollectionEquality().hash(_comments),
  );

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GalleryThreadImplCopyWith<_$GalleryThreadImpl> get copyWith =>
      __$$GalleryThreadImplCopyWithImpl<_$GalleryThreadImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GalleryThreadImplToJson(this);
  }
}

abstract class _GalleryThread implements GalleryThread {
  const factory _GalleryThread({
    required final Gallery gallery,
    required final List<Comment> comments,
  }) = _$GalleryThreadImpl;

  factory _GalleryThread.fromJson(Map<String, dynamic> json) =
      _$GalleryThreadImpl.fromJson;

  @override
  Gallery get gallery;
  @override
  List<Comment> get comments;

  /// Create a copy of GalleryThread
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GalleryThreadImplCopyWith<_$GalleryThreadImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
