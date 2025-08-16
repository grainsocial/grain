// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_photo_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeletePhotoRequest _$DeletePhotoRequestFromJson(Map<String, dynamic> json) {
  return _DeletePhotoRequest.fromJson(json);
}

/// @nodoc
mixin _$DeletePhotoRequest {
  String get uri => throw _privateConstructorUsedError;

  /// Serializes this DeletePhotoRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeletePhotoRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeletePhotoRequestCopyWith<DeletePhotoRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeletePhotoRequestCopyWith<$Res> {
  factory $DeletePhotoRequestCopyWith(
    DeletePhotoRequest value,
    $Res Function(DeletePhotoRequest) then,
  ) = _$DeletePhotoRequestCopyWithImpl<$Res, DeletePhotoRequest>;
  @useResult
  $Res call({String uri});
}

/// @nodoc
class _$DeletePhotoRequestCopyWithImpl<$Res, $Val extends DeletePhotoRequest>
    implements $DeletePhotoRequestCopyWith<$Res> {
  _$DeletePhotoRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeletePhotoRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _value.copyWith(
            uri: null == uri
                ? _value.uri
                : uri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$DeletePhotoRequestImplCopyWith<$Res>
    implements $DeletePhotoRequestCopyWith<$Res> {
  factory _$$DeletePhotoRequestImplCopyWith(
    _$DeletePhotoRequestImpl value,
    $Res Function(_$DeletePhotoRequestImpl) then,
  ) = __$$DeletePhotoRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String uri});
}

/// @nodoc
class __$$DeletePhotoRequestImplCopyWithImpl<$Res>
    extends _$DeletePhotoRequestCopyWithImpl<$Res, _$DeletePhotoRequestImpl>
    implements _$$DeletePhotoRequestImplCopyWith<$Res> {
  __$$DeletePhotoRequestImplCopyWithImpl(
    _$DeletePhotoRequestImpl _value,
    $Res Function(_$DeletePhotoRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeletePhotoRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _$DeletePhotoRequestImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$DeletePhotoRequestImpl implements _DeletePhotoRequest {
  const _$DeletePhotoRequestImpl({required this.uri});

  factory _$DeletePhotoRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeletePhotoRequestImplFromJson(json);

  @override
  final String uri;

  @override
  String toString() {
    return 'DeletePhotoRequest(uri: $uri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeletePhotoRequestImpl &&
            (identical(other.uri, uri) || other.uri == uri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, uri);

  /// Create a copy of DeletePhotoRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeletePhotoRequestImplCopyWith<_$DeletePhotoRequestImpl> get copyWith =>
      __$$DeletePhotoRequestImplCopyWithImpl<_$DeletePhotoRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeletePhotoRequestImplToJson(this);
  }
}

abstract class _DeletePhotoRequest implements DeletePhotoRequest {
  const factory _DeletePhotoRequest({required final String uri}) =
      _$DeletePhotoRequestImpl;

  factory _DeletePhotoRequest.fromJson(Map<String, dynamic> json) =
      _$DeletePhotoRequestImpl.fromJson;

  @override
  String get uri;

  /// Create a copy of DeletePhotoRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeletePhotoRequestImplCopyWith<_$DeletePhotoRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
