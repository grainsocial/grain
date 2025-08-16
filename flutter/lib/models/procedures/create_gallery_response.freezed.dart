// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_gallery_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateGalleryResponse _$CreateGalleryResponseFromJson(
  Map<String, dynamic> json,
) {
  return _CreateGalleryResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateGalleryResponse {
  String get galleryUri => throw _privateConstructorUsedError;

  /// Serializes this CreateGalleryResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGalleryResponseCopyWith<CreateGalleryResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGalleryResponseCopyWith<$Res> {
  factory $CreateGalleryResponseCopyWith(
    CreateGalleryResponse value,
    $Res Function(CreateGalleryResponse) then,
  ) = _$CreateGalleryResponseCopyWithImpl<$Res, CreateGalleryResponse>;
  @useResult
  $Res call({String galleryUri});
}

/// @nodoc
class _$CreateGalleryResponseCopyWithImpl<
  $Res,
  $Val extends CreateGalleryResponse
>
    implements $CreateGalleryResponseCopyWith<$Res> {
  _$CreateGalleryResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? galleryUri = null}) {
    return _then(
      _value.copyWith(
            galleryUri: null == galleryUri
                ? _value.galleryUri
                : galleryUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateGalleryResponseImplCopyWith<$Res>
    implements $CreateGalleryResponseCopyWith<$Res> {
  factory _$$CreateGalleryResponseImplCopyWith(
    _$CreateGalleryResponseImpl value,
    $Res Function(_$CreateGalleryResponseImpl) then,
  ) = __$$CreateGalleryResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String galleryUri});
}

/// @nodoc
class __$$CreateGalleryResponseImplCopyWithImpl<$Res>
    extends
        _$CreateGalleryResponseCopyWithImpl<$Res, _$CreateGalleryResponseImpl>
    implements _$$CreateGalleryResponseImplCopyWith<$Res> {
  __$$CreateGalleryResponseImplCopyWithImpl(
    _$CreateGalleryResponseImpl _value,
    $Res Function(_$CreateGalleryResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? galleryUri = null}) {
    return _then(
      _$CreateGalleryResponseImpl(
        galleryUri: null == galleryUri
            ? _value.galleryUri
            : galleryUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateGalleryResponseImpl implements _CreateGalleryResponse {
  const _$CreateGalleryResponseImpl({required this.galleryUri});

  factory _$CreateGalleryResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGalleryResponseImplFromJson(json);

  @override
  final String galleryUri;

  @override
  String toString() {
    return 'CreateGalleryResponse(galleryUri: $galleryUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGalleryResponseImpl &&
            (identical(other.galleryUri, galleryUri) ||
                other.galleryUri == galleryUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, galleryUri);

  /// Create a copy of CreateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGalleryResponseImplCopyWith<_$CreateGalleryResponseImpl>
  get copyWith =>
      __$$CreateGalleryResponseImplCopyWithImpl<_$CreateGalleryResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGalleryResponseImplToJson(this);
  }
}

abstract class _CreateGalleryResponse implements CreateGalleryResponse {
  const factory _CreateGalleryResponse({required final String galleryUri}) =
      _$CreateGalleryResponseImpl;

  factory _CreateGalleryResponse.fromJson(Map<String, dynamic> json) =
      _$CreateGalleryResponseImpl.fromJson;

  @override
  String get galleryUri;

  /// Create a copy of CreateGalleryResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGalleryResponseImplCopyWith<_$CreateGalleryResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
