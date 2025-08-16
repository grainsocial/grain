// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_gallery_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteGalleryResponse _$DeleteGalleryResponseFromJson(
  Map<String, dynamic> json,
) {
  return _DeleteGalleryResponse.fromJson(json);
}

/// @nodoc
mixin _$DeleteGalleryResponse {
  bool get success => throw _privateConstructorUsedError;

  /// Serializes this DeleteGalleryResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteGalleryResponseCopyWith<DeleteGalleryResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteGalleryResponseCopyWith<$Res> {
  factory $DeleteGalleryResponseCopyWith(
    DeleteGalleryResponse value,
    $Res Function(DeleteGalleryResponse) then,
  ) = _$DeleteGalleryResponseCopyWithImpl<$Res, DeleteGalleryResponse>;
  @useResult
  $Res call({bool success});
}

/// @nodoc
class _$DeleteGalleryResponseCopyWithImpl<
  $Res,
  $Val extends DeleteGalleryResponse
>
    implements $DeleteGalleryResponseCopyWith<$Res> {
  _$DeleteGalleryResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteGalleryResponse
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
abstract class _$$DeleteGalleryResponseImplCopyWith<$Res>
    implements $DeleteGalleryResponseCopyWith<$Res> {
  factory _$$DeleteGalleryResponseImplCopyWith(
    _$DeleteGalleryResponseImpl value,
    $Res Function(_$DeleteGalleryResponseImpl) then,
  ) = __$$DeleteGalleryResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool success});
}

/// @nodoc
class __$$DeleteGalleryResponseImplCopyWithImpl<$Res>
    extends
        _$DeleteGalleryResponseCopyWithImpl<$Res, _$DeleteGalleryResponseImpl>
    implements _$$DeleteGalleryResponseImplCopyWith<$Res> {
  __$$DeleteGalleryResponseImplCopyWithImpl(
    _$DeleteGalleryResponseImpl _value,
    $Res Function(_$DeleteGalleryResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? success = null}) {
    return _then(
      _$DeleteGalleryResponseImpl(
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
class _$DeleteGalleryResponseImpl implements _DeleteGalleryResponse {
  const _$DeleteGalleryResponseImpl({required this.success});

  factory _$DeleteGalleryResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteGalleryResponseImplFromJson(json);

  @override
  final bool success;

  @override
  String toString() {
    return 'DeleteGalleryResponse(success: $success)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteGalleryResponseImpl &&
            (identical(other.success, success) || other.success == success));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, success);

  /// Create a copy of DeleteGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteGalleryResponseImplCopyWith<_$DeleteGalleryResponseImpl>
  get copyWith =>
      __$$DeleteGalleryResponseImplCopyWithImpl<_$DeleteGalleryResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteGalleryResponseImplToJson(this);
  }
}

abstract class _DeleteGalleryResponse implements DeleteGalleryResponse {
  const factory _DeleteGalleryResponse({required final bool success}) =
      _$DeleteGalleryResponseImpl;

  factory _DeleteGalleryResponse.fromJson(Map<String, dynamic> json) =
      _$DeleteGalleryResponseImpl.fromJson;

  @override
  bool get success;

  /// Create a copy of DeleteGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteGalleryResponseImplCopyWith<_$DeleteGalleryResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
