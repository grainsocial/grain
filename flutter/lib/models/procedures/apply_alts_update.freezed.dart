// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'apply_alts_update.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ApplyAltsUpdate _$ApplyAltsUpdateFromJson(Map<String, dynamic> json) {
  return _ApplyAltsUpdate.fromJson(json);
}

/// @nodoc
mixin _$ApplyAltsUpdate {
  String get photoUri => throw _privateConstructorUsedError;
  String get alt => throw _privateConstructorUsedError;

  /// Serializes this ApplyAltsUpdate to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ApplyAltsUpdate
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ApplyAltsUpdateCopyWith<ApplyAltsUpdate> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ApplyAltsUpdateCopyWith<$Res> {
  factory $ApplyAltsUpdateCopyWith(
    ApplyAltsUpdate value,
    $Res Function(ApplyAltsUpdate) then,
  ) = _$ApplyAltsUpdateCopyWithImpl<$Res, ApplyAltsUpdate>;
  @useResult
  $Res call({String photoUri, String alt});
}

/// @nodoc
class _$ApplyAltsUpdateCopyWithImpl<$Res, $Val extends ApplyAltsUpdate>
    implements $ApplyAltsUpdateCopyWith<$Res> {
  _$ApplyAltsUpdateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ApplyAltsUpdate
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? photoUri = null, Object? alt = null}) {
    return _then(
      _value.copyWith(
            photoUri: null == photoUri
                ? _value.photoUri
                : photoUri // ignore: cast_nullable_to_non_nullable
                      as String,
            alt: null == alt
                ? _value.alt
                : alt // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ApplyAltsUpdateImplCopyWith<$Res>
    implements $ApplyAltsUpdateCopyWith<$Res> {
  factory _$$ApplyAltsUpdateImplCopyWith(
    _$ApplyAltsUpdateImpl value,
    $Res Function(_$ApplyAltsUpdateImpl) then,
  ) = __$$ApplyAltsUpdateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String photoUri, String alt});
}

/// @nodoc
class __$$ApplyAltsUpdateImplCopyWithImpl<$Res>
    extends _$ApplyAltsUpdateCopyWithImpl<$Res, _$ApplyAltsUpdateImpl>
    implements _$$ApplyAltsUpdateImplCopyWith<$Res> {
  __$$ApplyAltsUpdateImplCopyWithImpl(
    _$ApplyAltsUpdateImpl _value,
    $Res Function(_$ApplyAltsUpdateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ApplyAltsUpdate
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? photoUri = null, Object? alt = null}) {
    return _then(
      _$ApplyAltsUpdateImpl(
        photoUri: null == photoUri
            ? _value.photoUri
            : photoUri // ignore: cast_nullable_to_non_nullable
                  as String,
        alt: null == alt
            ? _value.alt
            : alt // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ApplyAltsUpdateImpl implements _ApplyAltsUpdate {
  const _$ApplyAltsUpdateImpl({required this.photoUri, required this.alt});

  factory _$ApplyAltsUpdateImpl.fromJson(Map<String, dynamic> json) =>
      _$$ApplyAltsUpdateImplFromJson(json);

  @override
  final String photoUri;
  @override
  final String alt;

  @override
  String toString() {
    return 'ApplyAltsUpdate(photoUri: $photoUri, alt: $alt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ApplyAltsUpdateImpl &&
            (identical(other.photoUri, photoUri) ||
                other.photoUri == photoUri) &&
            (identical(other.alt, alt) || other.alt == alt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, photoUri, alt);

  /// Create a copy of ApplyAltsUpdate
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ApplyAltsUpdateImplCopyWith<_$ApplyAltsUpdateImpl> get copyWith =>
      __$$ApplyAltsUpdateImplCopyWithImpl<_$ApplyAltsUpdateImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ApplyAltsUpdateImplToJson(this);
  }
}

abstract class _ApplyAltsUpdate implements ApplyAltsUpdate {
  const factory _ApplyAltsUpdate({
    required final String photoUri,
    required final String alt,
  }) = _$ApplyAltsUpdateImpl;

  factory _ApplyAltsUpdate.fromJson(Map<String, dynamic> json) =
      _$ApplyAltsUpdateImpl.fromJson;

  @override
  String get photoUri;
  @override
  String get alt;

  /// Create a copy of ApplyAltsUpdate
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ApplyAltsUpdateImplCopyWith<_$ApplyAltsUpdateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
