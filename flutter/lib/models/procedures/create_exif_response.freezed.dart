// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_exif_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateExifResponse _$CreateExifResponseFromJson(Map<String, dynamic> json) {
  return _CreateExifResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateExifResponse {
  String get exifUri => throw _privateConstructorUsedError;

  /// Serializes this CreateExifResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateExifResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateExifResponseCopyWith<CreateExifResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateExifResponseCopyWith<$Res> {
  factory $CreateExifResponseCopyWith(
    CreateExifResponse value,
    $Res Function(CreateExifResponse) then,
  ) = _$CreateExifResponseCopyWithImpl<$Res, CreateExifResponse>;
  @useResult
  $Res call({String exifUri});
}

/// @nodoc
class _$CreateExifResponseCopyWithImpl<$Res, $Val extends CreateExifResponse>
    implements $CreateExifResponseCopyWith<$Res> {
  _$CreateExifResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateExifResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? exifUri = null}) {
    return _then(
      _value.copyWith(
            exifUri: null == exifUri
                ? _value.exifUri
                : exifUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateExifResponseImplCopyWith<$Res>
    implements $CreateExifResponseCopyWith<$Res> {
  factory _$$CreateExifResponseImplCopyWith(
    _$CreateExifResponseImpl value,
    $Res Function(_$CreateExifResponseImpl) then,
  ) = __$$CreateExifResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String exifUri});
}

/// @nodoc
class __$$CreateExifResponseImplCopyWithImpl<$Res>
    extends _$CreateExifResponseCopyWithImpl<$Res, _$CreateExifResponseImpl>
    implements _$$CreateExifResponseImplCopyWith<$Res> {
  __$$CreateExifResponseImplCopyWithImpl(
    _$CreateExifResponseImpl _value,
    $Res Function(_$CreateExifResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateExifResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? exifUri = null}) {
    return _then(
      _$CreateExifResponseImpl(
        exifUri: null == exifUri
            ? _value.exifUri
            : exifUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateExifResponseImpl implements _CreateExifResponse {
  const _$CreateExifResponseImpl({required this.exifUri});

  factory _$CreateExifResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateExifResponseImplFromJson(json);

  @override
  final String exifUri;

  @override
  String toString() {
    return 'CreateExifResponse(exifUri: $exifUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateExifResponseImpl &&
            (identical(other.exifUri, exifUri) || other.exifUri == exifUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, exifUri);

  /// Create a copy of CreateExifResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateExifResponseImplCopyWith<_$CreateExifResponseImpl> get copyWith =>
      __$$CreateExifResponseImplCopyWithImpl<_$CreateExifResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateExifResponseImplToJson(this);
  }
}

abstract class _CreateExifResponse implements CreateExifResponse {
  const factory _CreateExifResponse({required final String exifUri}) =
      _$CreateExifResponseImpl;

  factory _CreateExifResponse.fromJson(Map<String, dynamic> json) =
      _$CreateExifResponseImpl.fromJson;

  @override
  String get exifUri;

  /// Create a copy of CreateExifResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateExifResponseImplCopyWith<_$CreateExifResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
