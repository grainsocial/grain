// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_favorite_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteFavoriteResponse _$DeleteFavoriteResponseFromJson(
  Map<String, dynamic> json,
) {
  return _DeleteFavoriteResponse.fromJson(json);
}

/// @nodoc
mixin _$DeleteFavoriteResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this DeleteFavoriteResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteFavoriteResponseCopyWith<DeleteFavoriteResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteFavoriteResponseCopyWith<$Res> {
  factory $DeleteFavoriteResponseCopyWith(
    DeleteFavoriteResponse value,
    $Res Function(DeleteFavoriteResponse) then,
  ) = _$DeleteFavoriteResponseCopyWithImpl<$Res, DeleteFavoriteResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$DeleteFavoriteResponseCopyWithImpl<
  $Res,
  $Val extends DeleteFavoriteResponse
>
    implements $DeleteFavoriteResponseCopyWith<$Res> {
  _$DeleteFavoriteResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteFavoriteResponse
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
abstract class _$$DeleteFavoriteResponseImplCopyWith<$Res>
    implements $DeleteFavoriteResponseCopyWith<$Res> {
  factory _$$DeleteFavoriteResponseImplCopyWith(
    _$DeleteFavoriteResponseImpl value,
    $Res Function(_$DeleteFavoriteResponseImpl) then,
  ) = __$$DeleteFavoriteResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$DeleteFavoriteResponseImplCopyWithImpl<$Res>
    extends
        _$DeleteFavoriteResponseCopyWithImpl<$Res, _$DeleteFavoriteResponseImpl>
    implements _$$DeleteFavoriteResponseImplCopyWith<$Res> {
  __$$DeleteFavoriteResponseImplCopyWithImpl(
    _$DeleteFavoriteResponseImpl _value,
    $Res Function(_$DeleteFavoriteResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$DeleteFavoriteResponseImpl(
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
class _$DeleteFavoriteResponseImpl implements _DeleteFavoriteResponse {
  const _$DeleteFavoriteResponseImpl({required this.success});

  factory _$DeleteFavoriteResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteFavoriteResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'DeleteFavoriteResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteFavoriteResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of DeleteFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteFavoriteResponseImplCopyWith<_$DeleteFavoriteResponseImpl>
  get copyWith =>
      __$$DeleteFavoriteResponseImplCopyWithImpl<_$DeleteFavoriteResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteFavoriteResponseImplToJson(this);
  }
}

abstract class _DeleteFavoriteResponse implements DeleteFavoriteResponse {
  const factory _DeleteFavoriteResponse({required final bool success}) =
      _$DeleteFavoriteResponseImpl;

  factory _DeleteFavoriteResponse.fromJson(Map<String, dynamic> json) =
      _$DeleteFavoriteResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of DeleteFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteFavoriteResponseImplCopyWith<_$DeleteFavoriteResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
