// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'update_gallery_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

UpdateGalleryResponse _$UpdateGalleryResponseFromJson(
  Map<String, dynamic> json,
) {
  return _UpdateGalleryResponse.fromJson(json);
}

/// @nodoc
mixin _$UpdateGalleryResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this UpdateGalleryResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UpdateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UpdateGalleryResponseCopyWith<UpdateGalleryResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UpdateGalleryResponseCopyWith<$Res> {
  factory $UpdateGalleryResponseCopyWith(
    UpdateGalleryResponse value,
    $Res Function(UpdateGalleryResponse) then,
  ) = _$UpdateGalleryResponseCopyWithImpl<$Res, UpdateGalleryResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$UpdateGalleryResponseCopyWithImpl<
  $Res,
  $Val extends UpdateGalleryResponse
>
    implements $UpdateGalleryResponseCopyWith<$Res> {
  _$UpdateGalleryResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UpdateGalleryResponse
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
abstract class _$$UpdateGalleryResponseImplCopyWith<$Res>
    implements $UpdateGalleryResponseCopyWith<$Res> {
  factory _$$UpdateGalleryResponseImplCopyWith(
    _$UpdateGalleryResponseImpl value,
    $Res Function(_$UpdateGalleryResponseImpl) then,
  ) = __$$UpdateGalleryResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$UpdateGalleryResponseImplCopyWithImpl<$Res>
    extends
        _$UpdateGalleryResponseCopyWithImpl<$Res, _$UpdateGalleryResponseImpl>
    implements _$$UpdateGalleryResponseImplCopyWith<$Res> {
  __$$UpdateGalleryResponseImplCopyWithImpl(
    _$UpdateGalleryResponseImpl _value,
    $Res Function(_$UpdateGalleryResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of UpdateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$UpdateGalleryResponseImpl(
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
class _$UpdateGalleryResponseImpl implements _UpdateGalleryResponse {
  const _$UpdateGalleryResponseImpl({required this.success});

  factory _$UpdateGalleryResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$UpdateGalleryResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'UpdateGalleryResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UpdateGalleryResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of UpdateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UpdateGalleryResponseImplCopyWith<_$UpdateGalleryResponseImpl>
  get copyWith =>
      __$$UpdateGalleryResponseImplCopyWithImpl<_$UpdateGalleryResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$UpdateGalleryResponseImplToJson(this);
  }
}

abstract class _UpdateGalleryResponse implements UpdateGalleryResponse {
  const factory _UpdateGalleryResponse({required final bool success}) =
      _$UpdateGalleryResponseImpl;

  factory _UpdateGalleryResponse.fromJson(Map<String, dynamic> json) =
      _$UpdateGalleryResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of UpdateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UpdateGalleryResponseImplCopyWith<_$UpdateGalleryResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
