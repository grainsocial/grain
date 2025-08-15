// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'upload_photo_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

UploadPhotoResponse _$UploadPhotoResponseFromJson(Map<String, dynamic> json) {
  return _UploadPhotoResponse.fromJson(json);
}

/// @nodoc
mixin _$UploadPhotoResponse {
  String get photoUri => throw _privateConstructorUsedError;

  /// Serializes this UploadPhotoResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UploadPhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UploadPhotoResponseCopyWith<UploadPhotoResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UploadPhotoResponseCopyWith<$Res> {
  factory $UploadPhotoResponseCopyWith(
    UploadPhotoResponse value,
    $Res Function(UploadPhotoResponse) then,
  ) = _$UploadPhotoResponseCopyWithImpl<$Res, UploadPhotoResponse>;
  @useResult
  $Res call({String photoUri});
}

/// @nodoc
class _$UploadPhotoResponseCopyWithImpl<$Res, $Val extends UploadPhotoResponse>
    implements $UploadPhotoResponseCopyWith<$Res> {
  _$UploadPhotoResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UploadPhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? photoUri = null}) {
    return _then(
      _value.copyWith(
            photoUri: null == photoUri
                ? _value.photoUri
                : photoUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$UploadPhotoResponseImplCopyWith<$Res>
    implements $UploadPhotoResponseCopyWith<$Res> {
  factory _$$UploadPhotoResponseImplCopyWith(
    _$UploadPhotoResponseImpl value,
    $Res Function(_$UploadPhotoResponseImpl) then,
  ) = __$$UploadPhotoResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String photoUri});
}

/// @nodoc
class __$$UploadPhotoResponseImplCopyWithImpl<$Res>
    extends _$UploadPhotoResponseCopyWithImpl<$Res, _$UploadPhotoResponseImpl>
    implements _$$UploadPhotoResponseImplCopyWith<$Res> {
  __$$UploadPhotoResponseImplCopyWithImpl(
    _$UploadPhotoResponseImpl _value,
    $Res Function(_$UploadPhotoResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of UploadPhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? photoUri = null}) {
    return _then(
      _$UploadPhotoResponseImpl(
        photoUri: null == photoUri
            ? _value.photoUri
            : photoUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$UploadPhotoResponseImpl implements _UploadPhotoResponse {
  const _$UploadPhotoResponseImpl({required this.photoUri});

  factory _$UploadPhotoResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$UploadPhotoResponseImplFromJson(json);

  @override
  final String photoUri;

  @override
  String toString() {
    return 'UploadPhotoResponse(photoUri: $photoUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UploadPhotoResponseImpl &&
            (identical(other.photoUri, photoUri) ||
                other.photoUri == photoUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, photoUri);

  /// Create a copy of UploadPhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UploadPhotoResponseImplCopyWith<_$UploadPhotoResponseImpl> get copyWith =>
      __$$UploadPhotoResponseImplCopyWithImpl<_$UploadPhotoResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$UploadPhotoResponseImplToJson(this);
  }
}

abstract class _UploadPhotoResponse implements UploadPhotoResponse {
  const factory _UploadPhotoResponse({required final String photoUri}) =
      _$UploadPhotoResponseImpl;

  factory _UploadPhotoResponse.fromJson(Map<String, dynamic> json) =
      _$UploadPhotoResponseImpl.fromJson;

  @override
  String get photoUri;

  /// Create a copy of UploadPhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UploadPhotoResponseImplCopyWith<_$UploadPhotoResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
