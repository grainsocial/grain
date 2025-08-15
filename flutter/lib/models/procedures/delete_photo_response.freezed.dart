// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_photo_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeletePhotoResponse _$DeletePhotoResponseFromJson(Map<String, dynamic> json) {
  return _DeletePhotoResponse.fromJson(json);
}

/// @nodoc
mixin _$DeletePhotoResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this DeletePhotoResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeletePhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeletePhotoResponseCopyWith<DeletePhotoResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeletePhotoResponseCopyWith<$Res> {
  factory $DeletePhotoResponseCopyWith(
    DeletePhotoResponse value,
    $Res Function(DeletePhotoResponse) then,
  ) = _$DeletePhotoResponseCopyWithImpl<$Res, DeletePhotoResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$DeletePhotoResponseCopyWithImpl<$Res, $Val extends DeletePhotoResponse>
    implements $DeletePhotoResponseCopyWith<$Res> {
  _$DeletePhotoResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeletePhotoResponse
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
abstract class _$$DeletePhotoResponseImplCopyWith<$Res>
    implements $DeletePhotoResponseCopyWith<$Res> {
  factory _$$DeletePhotoResponseImplCopyWith(
    _$DeletePhotoResponseImpl value,
    $Res Function(_$DeletePhotoResponseImpl) then,
  ) = __$$DeletePhotoResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$DeletePhotoResponseImplCopyWithImpl<$Res>
    extends _$DeletePhotoResponseCopyWithImpl<$Res, _$DeletePhotoResponseImpl>
    implements _$$DeletePhotoResponseImplCopyWith<$Res> {
  __$$DeletePhotoResponseImplCopyWithImpl(
    _$DeletePhotoResponseImpl _value,
    $Res Function(_$DeletePhotoResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeletePhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$DeletePhotoResponseImpl(
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
class _$DeletePhotoResponseImpl implements _DeletePhotoResponse {
  const _$DeletePhotoResponseImpl({required this.success});

  factory _$DeletePhotoResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeletePhotoResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'DeletePhotoResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeletePhotoResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of DeletePhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeletePhotoResponseImplCopyWith<_$DeletePhotoResponseImpl> get copyWith =>
      __$$DeletePhotoResponseImplCopyWithImpl<_$DeletePhotoResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeletePhotoResponseImplToJson(this);
  }
}

abstract class _DeletePhotoResponse implements DeletePhotoResponse {
  const factory _DeletePhotoResponse({required final bool success}) =
      _$DeletePhotoResponseImpl;

  factory _DeletePhotoResponse.fromJson(Map<String, dynamic> json) =
      _$DeletePhotoResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of DeletePhotoResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeletePhotoResponseImplCopyWith<_$DeletePhotoResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
