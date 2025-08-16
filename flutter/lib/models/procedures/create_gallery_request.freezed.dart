// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_gallery_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateGalleryRequest _$CreateGalleryRequestFromJson(Map<String, dynamic> json) {
  return _CreateGalleryRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateGalleryRequest {
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this CreateGalleryRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGalleryRequestCopyWith<CreateGalleryRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGalleryRequestCopyWith<$Res> {
  factory $CreateGalleryRequestCopyWith(
    CreateGalleryRequest value,
    $Res Function(CreateGalleryRequest) then,
  ) = _$CreateGalleryRequestCopyWithImpl<$Res, CreateGalleryRequest>;
  @useResult
  $Res call({String title, String? description});
}

/// @nodoc
class _$CreateGalleryRequestCopyWithImpl<
  $Res,
  $Val extends CreateGalleryRequest
>
    implements $CreateGalleryRequestCopyWith<$Res> {
  _$CreateGalleryRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? title = null, Object? description = freezed}) {
    return _then(
      _value.copyWith(
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
abstract class _$$CreateGalleryRequestImplCopyWith<$Res>
    implements $CreateGalleryRequestCopyWith<$Res> {
  factory _$$CreateGalleryRequestImplCopyWith(
    _$CreateGalleryRequestImpl value,
    $Res Function(_$CreateGalleryRequestImpl) then,
  ) = __$$CreateGalleryRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, String? description});
}

/// @nodoc
class __$$CreateGalleryRequestImplCopyWithImpl<$Res>
    extends _$CreateGalleryRequestCopyWithImpl<$Res, _$CreateGalleryRequestImpl>
    implements _$$CreateGalleryRequestImplCopyWith<$Res> {
  __$$CreateGalleryRequestImplCopyWithImpl(
    _$CreateGalleryRequestImpl _value,
    $Res Function(_$CreateGalleryRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? title = null, Object? description = freezed}) {
    return _then(
      _$CreateGalleryRequestImpl(
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
class _$CreateGalleryRequestImpl implements _CreateGalleryRequest {
  const _$CreateGalleryRequestImpl({required this.title, this.description});

  factory _$CreateGalleryRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGalleryRequestImplFromJson(json);

  @override
  final String title;
  @override
  final String? description;

  @override
  String toString() {
    return 'CreateGalleryRequest(title: $title, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGalleryRequestImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, description);

  /// Create a copy of CreateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGalleryRequestImplCopyWith<_$CreateGalleryRequestImpl>
  get copyWith =>
      __$$CreateGalleryRequestImplCopyWithImpl<_$CreateGalleryRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGalleryRequestImplToJson(this);
  }
}

abstract class _CreateGalleryRequest implements CreateGalleryRequest {
  const factory _CreateGalleryRequest({
    required final String title,
    final String? description,
  }) = _$CreateGalleryRequestImpl;

  factory _CreateGalleryRequest.fromJson(Map<String, dynamic> json) =
      _$CreateGalleryRequestImpl.fromJson;

  @override
  String get title;
  @override
  String? get description;

  /// Create a copy of CreateGalleryRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGalleryRequestImplCopyWith<_$CreateGalleryRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
