// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_gallery_item_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateGalleryItemResponse _$CreateGalleryItemResponseFromJson(
  Map<String, dynamic> json,
) {
  return _CreateGalleryItemResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateGalleryItemResponse {
  String get itemUri => throw _privateConstructorUsedError;

  /// Serializes this CreateGalleryItemResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGalleryItemResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGalleryItemResponseCopyWith<CreateGalleryItemResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGalleryItemResponseCopyWith<$Res> {
  factory $CreateGalleryItemResponseCopyWith(
    CreateGalleryItemResponse value,
    $Res Function(CreateGalleryItemResponse) then,
  ) = _$CreateGalleryItemResponseCopyWithImpl<$Res, CreateGalleryItemResponse>;
  @useResult
  $Res call({String itemUri});
}

/// @nodoc
class _$CreateGalleryItemResponseCopyWithImpl<
  $Res,
  $Val extends CreateGalleryItemResponse
>
    implements $CreateGalleryItemResponseCopyWith<$Res> {
  _$CreateGalleryItemResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGalleryItemResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? itemUri = null}) {
    return _then(
      _value.copyWith(
            itemUri: null == itemUri
                ? _value.itemUri
                : itemUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateGalleryItemResponseImplCopyWith<$Res>
    implements $CreateGalleryItemResponseCopyWith<$Res> {
  factory _$$CreateGalleryItemResponseImplCopyWith(
    _$CreateGalleryItemResponseImpl value,
    $Res Function(_$CreateGalleryItemResponseImpl) then,
  ) = __$$CreateGalleryItemResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String itemUri});
}

/// @nodoc
class __$$CreateGalleryItemResponseImplCopyWithImpl<$Res>
    extends
        _$CreateGalleryItemResponseCopyWithImpl<
          $Res,
          _$CreateGalleryItemResponseImpl
        >
    implements _$$CreateGalleryItemResponseImplCopyWith<$Res> {
  __$$CreateGalleryItemResponseImplCopyWithImpl(
    _$CreateGalleryItemResponseImpl _value,
    $Res Function(_$CreateGalleryItemResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateGalleryItemResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? itemUri = null}) {
    return _then(
      _$CreateGalleryItemResponseImpl(
        itemUri: null == itemUri
            ? _value.itemUri
            : itemUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateGalleryItemResponseImpl implements _CreateGalleryItemResponse {
  const _$CreateGalleryItemResponseImpl({required this.itemUri});

  factory _$CreateGalleryItemResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGalleryItemResponseImplFromJson(json);

  @override
  final String itemUri;

  @override
  String toString() {
    return 'CreateGalleryItemResponse(itemUri: $itemUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGalleryItemResponseImpl &&
            (identical(other.itemUri, itemUri) || other.itemUri == itemUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, itemUri);

  /// Create a copy of CreateGalleryItemResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGalleryItemResponseImplCopyWith<_$CreateGalleryItemResponseImpl>
  get copyWith =>
      __$$CreateGalleryItemResponseImplCopyWithImpl<
        _$CreateGalleryItemResponseImpl
      >(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGalleryItemResponseImplToJson(this);
  }
}

abstract class _CreateGalleryItemResponse implements CreateGalleryItemResponse {
  const factory _CreateGalleryItemResponse({required final String itemUri}) =
      _$CreateGalleryItemResponseImpl;

  factory _CreateGalleryItemResponse.fromJson(Map<String, dynamic> json) =
      _$CreateGalleryItemResponseImpl.fromJson;

  @override
  String get itemUri;

  /// Create a copy of CreateGalleryItemResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGalleryItemResponseImplCopyWith<_$CreateGalleryItemResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
