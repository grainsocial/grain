// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_comment_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteCommentResponse _$DeleteCommentResponseFromJson(
  Map<String, dynamic> json,
) {
  return _DeleteCommentResponse.fromJson(json);
}

/// @nodoc
mixin _$DeleteCommentResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this DeleteCommentResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteCommentResponseCopyWith<DeleteCommentResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteCommentResponseCopyWith<$Res> {
  factory $DeleteCommentResponseCopyWith(
    DeleteCommentResponse value,
    $Res Function(DeleteCommentResponse) then,
  ) = _$DeleteCommentResponseCopyWithImpl<$Res, DeleteCommentResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$DeleteCommentResponseCopyWithImpl<
  $Res,
  $Val extends DeleteCommentResponse
>
    implements $DeleteCommentResponseCopyWith<$Res> {
  _$DeleteCommentResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteCommentResponse
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
abstract class _$$DeleteCommentResponseImplCopyWith<$Res>
    implements $DeleteCommentResponseCopyWith<$Res> {
  factory _$$DeleteCommentResponseImplCopyWith(
    _$DeleteCommentResponseImpl value,
    $Res Function(_$DeleteCommentResponseImpl) then,
  ) = __$$DeleteCommentResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$DeleteCommentResponseImplCopyWithImpl<$Res>
    extends
        _$DeleteCommentResponseCopyWithImpl<$Res, _$DeleteCommentResponseImpl>
    implements _$$DeleteCommentResponseImplCopyWith<$Res> {
  __$$DeleteCommentResponseImplCopyWithImpl(
    _$DeleteCommentResponseImpl _value,
    $Res Function(_$DeleteCommentResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$DeleteCommentResponseImpl(
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
class _$DeleteCommentResponseImpl implements _DeleteCommentResponse {
  const _$DeleteCommentResponseImpl({required this.success});

  factory _$DeleteCommentResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteCommentResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'DeleteCommentResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteCommentResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of DeleteCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteCommentResponseImplCopyWith<_$DeleteCommentResponseImpl>
  get copyWith =>
      __$$DeleteCommentResponseImplCopyWithImpl<_$DeleteCommentResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteCommentResponseImplToJson(this);
  }
}

abstract class _DeleteCommentResponse implements DeleteCommentResponse {
  const factory _DeleteCommentResponse({required final bool success}) =
      _$DeleteCommentResponseImpl;

  factory _DeleteCommentResponse.fromJson(Map<String, dynamic> json) =
      _$DeleteCommentResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of DeleteCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteCommentResponseImplCopyWith<_$DeleteCommentResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
