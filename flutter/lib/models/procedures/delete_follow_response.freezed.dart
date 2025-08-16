// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_follow_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteFollowResponse _$DeleteFollowResponseFromJson(Map<String, dynamic> json) {
  return _DeleteFollowResponse.fromJson(json);
}

/// @nodoc
mixin _$DeleteFollowResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this DeleteFollowResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteFollowResponseCopyWith<DeleteFollowResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteFollowResponseCopyWith<$Res> {
  factory $DeleteFollowResponseCopyWith(
    DeleteFollowResponse value,
    $Res Function(DeleteFollowResponse) then,
  ) = _$DeleteFollowResponseCopyWithImpl<$Res, DeleteFollowResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$DeleteFollowResponseCopyWithImpl<
  $Res,
  $Val extends DeleteFollowResponse
>
    implements $DeleteFollowResponseCopyWith<$Res> {
  _$DeleteFollowResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _value.copyWith(
            success: null == success
                ? _value.success
                : success // ignore: cast_nullable_to_non_nullable
                      as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$DeleteFollowResponseImplCopyWith<$Res>
    implements $DeleteFollowResponseCopyWith<$Res> {
  factory _$$DeleteFollowResponseImplCopyWith(
    _$DeleteFollowResponseImpl value,
    $Res Function(_$DeleteFollowResponseImpl) then,
  ) = __$$DeleteFollowResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$DeleteFollowResponseImplCopyWithImpl<$Res>
    extends _$DeleteFollowResponseCopyWithImpl<$Res, _$DeleteFollowResponseImpl>
    implements _$$DeleteFollowResponseImplCopyWith<$Res> {
  __$$DeleteFollowResponseImplCopyWithImpl(
    _$DeleteFollowResponseImpl _value,
    $Res Function(_$DeleteFollowResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$DeleteFollowResponseImpl(
        success: null == success
            ? _value.success
            : success // ignore: cast_nullable_to_non_nullable
                  as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$DeleteFollowResponseImpl implements _DeleteFollowResponse {
  const _$DeleteFollowResponseImpl({required this.success});

  factory _$DeleteFollowResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteFollowResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'DeleteFollowResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteFollowResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of DeleteFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteFollowResponseImplCopyWith<_$DeleteFollowResponseImpl>
  get copyWith =>
      __$$DeleteFollowResponseImplCopyWithImpl<_$DeleteFollowResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteFollowResponseImplToJson(this);
  }
}

abstract class _DeleteFollowResponse implements DeleteFollowResponse {
  const factory _DeleteFollowResponse({required final bool success}) =
      _$DeleteFollowResponseImpl;

  factory _DeleteFollowResponse.fromJson(Map<String, dynamic> json) =
      _$DeleteFollowResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of DeleteFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteFollowResponseImplCopyWith<_$DeleteFollowResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
