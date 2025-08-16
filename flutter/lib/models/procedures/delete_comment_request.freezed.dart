// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_comment_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteCommentRequest _$DeleteCommentRequestFromJson(Map<String, dynamic> json) {
  return _DeleteCommentRequest.fromJson(json);
}

/// @nodoc
mixin _$DeleteCommentRequest {
  String get uri => throw _privateConstructorUsedError;

  /// Serializes this DeleteCommentRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteCommentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteCommentRequestCopyWith<DeleteCommentRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteCommentRequestCopyWith<$Res> {
  factory $DeleteCommentRequestCopyWith(
    DeleteCommentRequest value,
    $Res Function(DeleteCommentRequest) then,
  ) = _$DeleteCommentRequestCopyWithImpl<$Res, DeleteCommentRequest>;
  @useResult
  $Res call({String uri});
}

/// @nodoc
class _$DeleteCommentRequestCopyWithImpl<
  $Res,
  $Val extends DeleteCommentRequest
>
    implements $DeleteCommentRequestCopyWith<$Res> {
  _$DeleteCommentRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteCommentRequest
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
abstract class _$$DeleteCommentRequestImplCopyWith<$Res>
    implements $DeleteCommentRequestCopyWith<$Res> {
  factory _$$DeleteCommentRequestImplCopyWith(
    _$DeleteCommentRequestImpl value,
    $Res Function(_$DeleteCommentRequestImpl) then,
  ) = __$$DeleteCommentRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String uri});
}

/// @nodoc
class __$$DeleteCommentRequestImplCopyWithImpl<$Res>
    extends _$DeleteCommentRequestCopyWithImpl<$Res, _$DeleteCommentRequestImpl>
    implements _$$DeleteCommentRequestImplCopyWith<$Res> {
  __$$DeleteCommentRequestImplCopyWithImpl(
    _$DeleteCommentRequestImpl _value,
    $Res Function(_$DeleteCommentRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteCommentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _$DeleteCommentRequestImpl(
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
class _$DeleteCommentRequestImpl implements _DeleteCommentRequest {
  const _$DeleteCommentRequestImpl({required this.uri});

  factory _$DeleteCommentRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteCommentRequestImplFromJson(json);

  @override
  final String uri;

  @override
  String toString() {
    return 'DeleteCommentRequest(uri: $uri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteCommentRequestImpl &&
            (identical(other.uri, uri) || other.uri == uri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, uri);

  /// Create a copy of DeleteCommentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteCommentRequestImplCopyWith<_$DeleteCommentRequestImpl>
  get copyWith =>
      __$$DeleteCommentRequestImplCopyWithImpl<_$DeleteCommentRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteCommentRequestImplToJson(this);
  }
}

abstract class _DeleteCommentRequest implements DeleteCommentRequest {
  const factory _DeleteCommentRequest({required final String uri}) =
      _$DeleteCommentRequestImpl;

  factory _DeleteCommentRequest.fromJson(Map<String, dynamic> json) =
      _$DeleteCommentRequestImpl.fromJson;

  @override
  String get uri;

  /// Create a copy of DeleteCommentRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteCommentRequestImplCopyWith<_$DeleteCommentRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
