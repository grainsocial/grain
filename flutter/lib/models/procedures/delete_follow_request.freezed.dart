// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_follow_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteFollowRequest _$DeleteFollowRequestFromJson(Map<String, dynamic> json) {
  return _DeleteFollowRequest.fromJson(json);
}

/// @nodoc
mixin _$DeleteFollowRequest {
  String get uri => throw _privateConstructorUsedError;

  /// Serializes this DeleteFollowRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteFollowRequestCopyWith<DeleteFollowRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteFollowRequestCopyWith<$Res> {
  factory $DeleteFollowRequestCopyWith(
    DeleteFollowRequest value,
    $Res Function(DeleteFollowRequest) then,
  ) = _$DeleteFollowRequestCopyWithImpl<$Res, DeleteFollowRequest>;
  @useResult
  $Res call({String uri});
}

/// @nodoc
class _$DeleteFollowRequestCopyWithImpl<$Res, $Val extends DeleteFollowRequest>
    implements $DeleteFollowRequestCopyWith<$Res> {
  _$DeleteFollowRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteFollowRequest
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
abstract class _$$DeleteFollowRequestImplCopyWith<$Res>
    implements $DeleteFollowRequestCopyWith<$Res> {
  factory _$$DeleteFollowRequestImplCopyWith(
    _$DeleteFollowRequestImpl value,
    $Res Function(_$DeleteFollowRequestImpl) then,
  ) = __$$DeleteFollowRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String uri});
}

/// @nodoc
class __$$DeleteFollowRequestImplCopyWithImpl<$Res>
    extends _$DeleteFollowRequestCopyWithImpl<$Res, _$DeleteFollowRequestImpl>
    implements _$$DeleteFollowRequestImplCopyWith<$Res> {
  __$$DeleteFollowRequestImplCopyWithImpl(
    _$DeleteFollowRequestImpl _value,
    $Res Function(_$DeleteFollowRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _$DeleteFollowRequestImpl(
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
class _$DeleteFollowRequestImpl implements _DeleteFollowRequest {
  const _$DeleteFollowRequestImpl({required this.uri});

  factory _$DeleteFollowRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteFollowRequestImplFromJson(json);

  @override
  final String uri;

  @override
  String toString() {
    return 'DeleteFollowRequest(uri: $uri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteFollowRequestImpl &&
            (identical(other.uri, uri) || other.uri == uri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, uri);

  /// Create a copy of DeleteFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteFollowRequestImplCopyWith<_$DeleteFollowRequestImpl> get copyWith =>
      __$$DeleteFollowRequestImplCopyWithImpl<_$DeleteFollowRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteFollowRequestImplToJson(this);
  }
}

abstract class _DeleteFollowRequest implements DeleteFollowRequest {
  const factory _DeleteFollowRequest({required final String uri}) =
      _$DeleteFollowRequestImpl;

  factory _DeleteFollowRequest.fromJson(Map<String, dynamic> json) =
      _$DeleteFollowRequestImpl.fromJson;

  @override
  String get uri;

  /// Create a copy of DeleteFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteFollowRequestImplCopyWith<_$DeleteFollowRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
