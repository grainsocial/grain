// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'apply_alts_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ApplyAltsResponse _$ApplyAltsResponseFromJson(Map<String, dynamic> json) {
  return _ApplyAltsResponse.fromJson(json);
}

/// @nodoc
mixin _$ApplyAltsResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this ApplyAltsResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ApplyAltsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ApplyAltsResponseCopyWith<ApplyAltsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ApplyAltsResponseCopyWith<$Res> {
  factory $ApplyAltsResponseCopyWith(
    ApplyAltsResponse value,
    $Res Function(ApplyAltsResponse) then,
  ) = _$ApplyAltsResponseCopyWithImpl<$Res, ApplyAltsResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$ApplyAltsResponseCopyWithImpl<$Res, $Val extends ApplyAltsResponse>
    implements $ApplyAltsResponseCopyWith<$Res> {
  _$ApplyAltsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ApplyAltsResponse
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
abstract class _$$ApplyAltsResponseImplCopyWith<$Res>
    implements $ApplyAltsResponseCopyWith<$Res> {
  factory _$$ApplyAltsResponseImplCopyWith(
    _$ApplyAltsResponseImpl value,
    $Res Function(_$ApplyAltsResponseImpl) then,
  ) = __$$ApplyAltsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$ApplyAltsResponseImplCopyWithImpl<$Res>
    extends _$ApplyAltsResponseCopyWithImpl<$Res, _$ApplyAltsResponseImpl>
    implements _$$ApplyAltsResponseImplCopyWith<$Res> {
  __$$ApplyAltsResponseImplCopyWithImpl(
    _$ApplyAltsResponseImpl _value,
    $Res Function(_$ApplyAltsResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ApplyAltsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$ApplyAltsResponseImpl(
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
class _$ApplyAltsResponseImpl implements _ApplyAltsResponse {
  const _$ApplyAltsResponseImpl({required this.success});

  factory _$ApplyAltsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$ApplyAltsResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'ApplyAltsResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ApplyAltsResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of ApplyAltsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ApplyAltsResponseImplCopyWith<_$ApplyAltsResponseImpl> get copyWith =>
      __$$ApplyAltsResponseImplCopyWithImpl<_$ApplyAltsResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ApplyAltsResponseImplToJson(this);
  }
}

abstract class _ApplyAltsResponse implements ApplyAltsResponse {
  const factory _ApplyAltsResponse({required final bool success}) =
      _$ApplyAltsResponseImpl;

  factory _ApplyAltsResponse.fromJson(Map<String, dynamic> json) =
      _$ApplyAltsResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of ApplyAltsResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ApplyAltsResponseImplCopyWith<_$ApplyAltsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
