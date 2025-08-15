// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_gallery_item_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateGalleryItemRequest _$CreateGalleryItemRequestFromJson(
  Map<String, dynamic> json,
) {
  return _CreateGalleryItemRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateGalleryItemRequest {
  String get galleryUri => throw _privateConstructorUsedError;
  String get photoUri => throw _privateConstructorUsedError;
  int get position => throw _privateConstructorUsedError;

  /// Serializes this CreateGalleryItemRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGalleryItemRequestCopyWith<CreateGalleryItemRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGalleryItemRequestCopyWith<$Res> {
  factory $CreateGalleryItemRequestCopyWith(
    CreateGalleryItemRequest value,
    $Res Function(CreateGalleryItemRequest) then,
  ) = _$CreateGalleryItemRequestCopyWithImpl<$Res, CreateGalleryItemRequest>;
  @useResult
  $Res call({String galleryUri, String photoUri, int position});
}

/// @nodoc
class _$CreateGalleryItemRequestCopyWithImpl<
  $Res,
  $Val extends CreateGalleryItemRequest
>
    implements $CreateGalleryItemRequestCopyWith<$Res> {
  _$CreateGalleryItemRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? galleryUri = null,
    Object? photoUri = null,
    Object? position = null,
  }) {
    return _then(
      _value.copyWith(
            galleryUri: null == galleryUri
                ? _value.galleryUri
                : galleryUri // ignore: cast_nullable_to_non_nullable
                      as String,
            photoUri: null == photoUri
                ? _value.photoUri
                : photoUri // ignore: cast_nullable_to_non_nullable
                      as String,
            position: null == position
                ? _value.position
                : position // ignore: cast_nullable_to_non_nullable
                      as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateGalleryItemRequestImplCopyWith<$Res>
    implements $CreateGalleryItemRequestCopyWith<$Res> {
  factory _$$CreateGalleryItemRequestImplCopyWith(
    _$CreateGalleryItemRequestImpl value,
    $Res Function(_$CreateGalleryItemRequestImpl) then,
  ) = __$$CreateGalleryItemRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String galleryUri, String photoUri, int position});
}

/// @nodoc
class __$$CreateGalleryItemRequestImplCopyWithImpl<$Res>
    extends
        _$CreateGalleryItemRequestCopyWithImpl<
          $Res,
          _$CreateGalleryItemRequestImpl
        >
    implements _$$CreateGalleryItemRequestImplCopyWith<$Res> {
  __$$CreateGalleryItemRequestImplCopyWithImpl(
    _$CreateGalleryItemRequestImpl _value,
    $Res Function(_$CreateGalleryItemRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? galleryUri = null,
    Object? photoUri = null,
    Object? position = null,
  }) {
    return _then(
      _$CreateGalleryItemRequestImpl(
        galleryUri: null == galleryUri
            ? _value.galleryUri
            : galleryUri // ignore: cast_nullable_to_non_nullable
                  as String,
        photoUri: null == photoUri
            ? _value.photoUri
            : photoUri // ignore: cast_nullable_to_non_nullable
                  as String,
        position: null == position
            ? _value.position
            : position // ignore: cast_nullable_to_non_nullable
                  as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateGalleryItemRequestImpl implements _CreateGalleryItemRequest {
  const _$CreateGalleryItemRequestImpl({
    required this.galleryUri,
    required this.photoUri,
    required this.position,
  });

  factory _$CreateGalleryItemRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGalleryItemRequestImplFromJson(json);

  @override
  final String galleryUri;
  @override
  final String photoUri;
  @override
  final int position;

  @override
  String toString() {
    return 'CreateGalleryItemRequest(galleryUri: $galleryUri, photoUri: $photoUri, position: $position)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGalleryItemRequestImpl &&
            (identical(other.galleryUri, galleryUri) ||
                other.galleryUri == galleryUri) &&
            (identical(other.photoUri, photoUri) ||
                other.photoUri == photoUri) &&
            (identical(other.position, position) ||
                other.position == position));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, galleryUri, photoUri, position);

  /// Create a copy of CreateGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGalleryItemRequestImplCopyWith<_$CreateGalleryItemRequestImpl>
  get copyWith =>
      __$$CreateGalleryItemRequestImplCopyWithImpl<
        _$CreateGalleryItemRequestImpl
      >(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGalleryItemRequestImplToJson(this);
  }
}

abstract class _CreateGalleryItemRequest implements CreateGalleryItemRequest {
  const factory _CreateGalleryItemRequest({
    required final String galleryUri,
    required final String photoUri,
    required final int position,
  }) = _$CreateGalleryItemRequestImpl;

  factory _CreateGalleryItemRequest.fromJson(Map<String, dynamic> json) =
      _$CreateGalleryItemRequestImpl.fromJson;

  @override
  String get galleryUri;
  @override
  String get photoUri;
  @override
  int get position;

  /// Create a copy of CreateGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGalleryItemRequestImplCopyWith<_$CreateGalleryItemRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
