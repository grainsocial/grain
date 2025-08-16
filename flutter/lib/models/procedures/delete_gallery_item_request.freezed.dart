// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_gallery_item_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteGalleryItemRequest _$DeleteGalleryItemRequestFromJson(
  Map<String, dynamic> json,
) {
  return _DeleteGalleryItemRequest.fromJson(json);
}

/// @nodoc
mixin _$DeleteGalleryItemRequest {
  String get uri => throw _privateConstructorUsedError;

  /// Serializes this DeleteGalleryItemRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteGalleryItemRequestCopyWith<DeleteGalleryItemRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteGalleryItemRequestCopyWith<$Res> {
  factory $DeleteGalleryItemRequestCopyWith(
    DeleteGalleryItemRequest value,
    $Res Function(DeleteGalleryItemRequest) then,
  ) = _$DeleteGalleryItemRequestCopyWithImpl<$Res, DeleteGalleryItemRequest>;
  @useResult
  $Res call({String uri});
}

/// @nodoc
class _$DeleteGalleryItemRequestCopyWithImpl<
  $Res,
  $Val extends DeleteGalleryItemRequest
>
    implements $DeleteGalleryItemRequestCopyWith<$Res> {
  _$DeleteGalleryItemRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _value.copyWith(
            uri: null == uri
                ? _value.uri
                : uri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$DeleteGalleryItemRequestImplCopyWith<$Res>
    implements $DeleteGalleryItemRequestCopyWith<$Res> {
  factory _$$DeleteGalleryItemRequestImplCopyWith(
    _$DeleteGalleryItemRequestImpl value,
    $Res Function(_$DeleteGalleryItemRequestImpl) then,
  ) = __$$DeleteGalleryItemRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String uri});
}

/// @nodoc
class __$$DeleteGalleryItemRequestImplCopyWithImpl<$Res>
    extends
        _$DeleteGalleryItemRequestCopyWithImpl<
          $Res,
          _$DeleteGalleryItemRequestImpl
        >
    implements _$$DeleteGalleryItemRequestImplCopyWith<$Res> {
  __$$DeleteGalleryItemRequestImplCopyWithImpl(
    _$DeleteGalleryItemRequestImpl _value,
    $Res Function(_$DeleteGalleryItemRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _$DeleteGalleryItemRequestImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$DeleteGalleryItemRequestImpl implements _DeleteGalleryItemRequest {
  const _$DeleteGalleryItemRequestImpl({required this.uri});

  factory _$DeleteGalleryItemRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteGalleryItemRequestImplFromJson(json);

  @override
  final String uri;

  @override
  String toString() {
    return 'DeleteGalleryItemRequest(uri: $uri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteGalleryItemRequestImpl &&
            (identical(other.uri, uri) || other.uri == uri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, uri);

  /// Create a copy of DeleteGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteGalleryItemRequestImplCopyWith<_$DeleteGalleryItemRequestImpl>
  get copyWith =>
      __$$DeleteGalleryItemRequestImplCopyWithImpl<
        _$DeleteGalleryItemRequestImpl
      >(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteGalleryItemRequestImplToJson(this);
  }
}

abstract class _DeleteGalleryItemRequest implements DeleteGalleryItemRequest {
  const factory _DeleteGalleryItemRequest({required final String uri}) =
      _$DeleteGalleryItemRequestImpl;

  factory _DeleteGalleryItemRequest.fromJson(Map<String, dynamic> json) =
      _$DeleteGalleryItemRequestImpl.fromJson;

  @override
  String get uri;

  /// Create a copy of DeleteGalleryItemRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteGalleryItemRequestImplCopyWith<_$DeleteGalleryItemRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
