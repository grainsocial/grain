// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gallery_viewer.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GalleryViewer _$GalleryViewerFromJson(Map<String, dynamic> json) {
  return _GalleryViewer.fromJson(json);
}

/// @nodoc
mixin _$GalleryViewer {
  String? get fav => throw _privateConstructorUsedError;

  /// Serializes this GalleryViewer to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GalleryViewer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GalleryViewerCopyWith<GalleryViewer> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GalleryViewerCopyWith<$Res> {
  factory $GalleryViewerCopyWith(
    GalleryViewer value,
    $Res Function(GalleryViewer) then,
  ) = _$GalleryViewerCopyWithImpl<$Res, GalleryViewer>;
  @useResult
  $Res call({String? fav});
}

/// @nodoc
class _$GalleryViewerCopyWithImpl<$Res, $Val extends GalleryViewer>
    implements $GalleryViewerCopyWith<$Res> {
  _$GalleryViewerCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GalleryViewer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? fav = freezed}) {
    return _then(
      _value.copyWith(
            fav: freezed == fav
                ? _value.fav
                : fav // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GalleryViewerImplCopyWith<$Res>
    implements $GalleryViewerCopyWith<$Res> {
  factory _$$GalleryViewerImplCopyWith(
    _$GalleryViewerImpl value,
    $Res Function(_$GalleryViewerImpl) then,
  ) = __$$GalleryViewerImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String? fav});
}

/// @nodoc
class __$$GalleryViewerImplCopyWithImpl<$Res>
    extends _$GalleryViewerCopyWithImpl<$Res, _$GalleryViewerImpl>
    implements _$$GalleryViewerImplCopyWith<$Res> {
  __$$GalleryViewerImplCopyWithImpl(
    _$GalleryViewerImpl _value,
    $Res Function(_$GalleryViewerImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GalleryViewer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? fav = freezed}) {
    return _then(
      _$GalleryViewerImpl(
        fav: freezed == fav
            ? _value.fav
            : fav // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GalleryViewerImpl implements _GalleryViewer {
  const _$GalleryViewerImpl({this.fav});

  factory _$GalleryViewerImpl.fromJson(Map<String, dynamic> json) =>
      _$$GalleryViewerImplFromJson(json);

  @override
  final String? fav;

  @override
  String toString() {
    return 'GalleryViewer(fav: $fav)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GalleryViewerImpl &&
            (identical(other.fav, fav) || other.fav == fav));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, fav);

  /// Create a copy of GalleryViewer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GalleryViewerImplCopyWith<_$GalleryViewerImpl> get copyWith =>
      __$$GalleryViewerImplCopyWithImpl<_$GalleryViewerImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GalleryViewerImplToJson(this);
  }
}

abstract class _GalleryViewer implements GalleryViewer {
  const factory _GalleryViewer({final String? fav}) = _$GalleryViewerImpl;

  factory _GalleryViewer.fromJson(Map<String, dynamic> json) =
      _$GalleryViewerImpl.fromJson;

  @override
  String? get fav;

  /// Create a copy of GalleryViewer
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GalleryViewerImplCopyWith<_$GalleryViewerImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
