// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'update_gallery_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

UpdateGalleryRequest _$UpdateGalleryRequestFromJson(Map<String, dynamic> json) {
  return _UpdateGalleryRequest.fromJson(json);
}

/// @nodoc
mixin _$UpdateGalleryRequest {
  String get galleryUri => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this UpdateGalleryRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UpdateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UpdateGalleryRequestCopyWith<UpdateGalleryRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UpdateGalleryRequestCopyWith<$Res> {
  factory $UpdateGalleryRequestCopyWith(
    UpdateGalleryRequest value,
    $Res Function(UpdateGalleryRequest) then,
  ) = _$UpdateGalleryRequestCopyWithImpl<$Res, UpdateGalleryRequest>;
  @useResult
  $Res call({String galleryUri, String title, String? description});
}

/// @nodoc
class _$UpdateGalleryRequestCopyWithImpl<
  $Res,
  $Val extends UpdateGalleryRequest
>
    implements $UpdateGalleryRequestCopyWith<$Res> {
  _$UpdateGalleryRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UpdateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? galleryUri = null,
    Object? title = null,
    Object? description = freezed,
  }) {
    return _then(
      _value.copyWith(
            galleryUri: null == galleryUri
                ? _value.galleryUri
                : galleryUri // ignore: cast_nullable_to_non_nullable
                      as String,
            title: null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$UpdateGalleryRequestImplCopyWith<$Res>
    implements $UpdateGalleryRequestCopyWith<$Res> {
  factory _$$UpdateGalleryRequestImplCopyWith(
    _$UpdateGalleryRequestImpl value,
    $Res Function(_$UpdateGalleryRequestImpl) then,
  ) = __$$UpdateGalleryRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String galleryUri, String title, String? description});
}

/// @nodoc
class __$$UpdateGalleryRequestImplCopyWithImpl<$Res>
    extends _$UpdateGalleryRequestCopyWithImpl<$Res, _$UpdateGalleryRequestImpl>
    implements _$$UpdateGalleryRequestImplCopyWith<$Res> {
  __$$UpdateGalleryRequestImplCopyWithImpl(
    _$UpdateGalleryRequestImpl _value,
    $Res Function(_$UpdateGalleryRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of UpdateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? galleryUri = null,
    Object? title = null,
    Object? description = freezed,
  }) {
    return _then(
      _$UpdateGalleryRequestImpl(
        galleryUri: null == galleryUri
            ? _value.galleryUri
            : galleryUri // ignore: cast_nullable_to_non_nullable
                  as String,
        title: null == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$UpdateGalleryRequestImpl implements _UpdateGalleryRequest {
  const _$UpdateGalleryRequestImpl({
    required this.galleryUri,
    required this.title,
    this.description,
  });

  factory _$UpdateGalleryRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$UpdateGalleryRequestImplFromJson(json);

  @override
  final String galleryUri;
  @override
  final String title;
  @override
  final String? description;

  @override
  String toString() {
    return 'UpdateGalleryRequest(galleryUri: $galleryUri, title: $title, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UpdateGalleryRequestImpl &&
            (identical(other.galleryUri, galleryUri) ||
                other.galleryUri == galleryUri) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, galleryUri, title, description);

  /// Create a copy of UpdateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UpdateGalleryRequestImplCopyWith<_$UpdateGalleryRequestImpl>
  get copyWith =>
      __$$UpdateGalleryRequestImplCopyWithImpl<_$UpdateGalleryRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$UpdateGalleryRequestImplToJson(this);
  }
}

abstract class _UpdateGalleryRequest implements UpdateGalleryRequest {
  const factory _UpdateGalleryRequest({
    required final String galleryUri,
    required final String title,
    final String? description,
  }) = _$UpdateGalleryRequestImpl;

  factory _UpdateGalleryRequest.fromJson(Map<String, dynamic> json) =
      _$UpdateGalleryRequestImpl.fromJson;

  @override
  String get galleryUri;
  @override
  String get title;
  @override
  String? get description;

  /// Create a copy of UpdateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UpdateGalleryRequestImplCopyWith<_$UpdateGalleryRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
