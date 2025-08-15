// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'delete_favorite_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

DeleteFavoriteRequest _$DeleteFavoriteRequestFromJson(
  Map<String, dynamic> json,
) {
  return _DeleteFavoriteRequest.fromJson(json);
}

/// @nodoc
mixin _$DeleteFavoriteRequest {
  String get uri => throw _privateConstructorUsedError;

  /// Serializes this DeleteFavoriteRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeleteFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeleteFavoriteRequestCopyWith<DeleteFavoriteRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeleteFavoriteRequestCopyWith<$Res> {
  factory $DeleteFavoriteRequestCopyWith(
    DeleteFavoriteRequest value,
    $Res Function(DeleteFavoriteRequest) then,
  ) = _$DeleteFavoriteRequestCopyWithImpl<$Res, DeleteFavoriteRequest>;
  @useResult
  $Res call({String uri});
}

/// @nodoc
class _$DeleteFavoriteRequestCopyWithImpl<
  $Res,
  $Val extends DeleteFavoriteRequest
>
    implements $DeleteFavoriteRequestCopyWith<$Res> {
  _$DeleteFavoriteRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeleteFavoriteRequest
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
abstract class _$$DeleteFavoriteRequestImplCopyWith<$Res>
    implements $DeleteFavoriteRequestCopyWith<$Res> {
  factory _$$DeleteFavoriteRequestImplCopyWith(
    _$DeleteFavoriteRequestImpl value,
    $Res Function(_$DeleteFavoriteRequestImpl) then,
  ) = __$$DeleteFavoriteRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String uri});
}

/// @nodoc
class __$$DeleteFavoriteRequestImplCopyWithImpl<$Res>
    extends
        _$DeleteFavoriteRequestCopyWithImpl<$Res, _$DeleteFavoriteRequestImpl>
    implements _$$DeleteFavoriteRequestImplCopyWith<$Res> {
  __$$DeleteFavoriteRequestImplCopyWithImpl(
    _$DeleteFavoriteRequestImpl _value,
    $Res Function(_$DeleteFavoriteRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DeleteFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? uri = null}) {
    return _then(
      _$DeleteFavoriteRequestImpl(
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
class _$DeleteFavoriteRequestImpl implements _DeleteFavoriteRequest {
  const _$DeleteFavoriteRequestImpl({required this.uri});

  factory _$DeleteFavoriteRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeleteFavoriteRequestImplFromJson(json);

  @override
  final String uri;

  @override
  String toString() {
    return 'DeleteFavoriteRequest(uri: $uri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeleteFavoriteRequestImpl &&
            (identical(other.uri, uri) || other.uri == uri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, uri);

  /// Create a copy of DeleteFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeleteFavoriteRequestImplCopyWith<_$DeleteFavoriteRequestImpl>
  get copyWith =>
      __$$DeleteFavoriteRequestImplCopyWithImpl<_$DeleteFavoriteRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DeleteFavoriteRequestImplToJson(this);
  }
}

abstract class _DeleteFavoriteRequest implements DeleteFavoriteRequest {
  const factory _DeleteFavoriteRequest({required final String uri}) =
      _$DeleteFavoriteRequestImpl;

  factory _DeleteFavoriteRequest.fromJson(Map<String, dynamic> json) =
      _$DeleteFavoriteRequestImpl.fromJson;

  @override
  String get uri;

  /// Create a copy of DeleteFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeleteFavoriteRequestImplCopyWith<_$DeleteFavoriteRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
