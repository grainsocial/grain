// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_favorite_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateFavoriteResponse _$CreateFavoriteResponseFromJson(
  Map<String, dynamic> json,
) {
  return _CreateFavoriteResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateFavoriteResponse {
  String get favoriteUri => throw _privateConstructorUsedError;

  /// Serializes this CreateFavoriteResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateFavoriteResponseCopyWith<CreateFavoriteResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateFavoriteResponseCopyWith<$Res> {
  factory $CreateFavoriteResponseCopyWith(
    CreateFavoriteResponse value,
    $Res Function(CreateFavoriteResponse) then,
  ) = _$CreateFavoriteResponseCopyWithImpl<$Res, CreateFavoriteResponse>;
  @useResult
  $Res call({String favoriteUri});
}

/// @nodoc
class _$CreateFavoriteResponseCopyWithImpl<
  $Res,
  $Val extends CreateFavoriteResponse
>
    implements $CreateFavoriteResponseCopyWith<$Res> {
  _$CreateFavoriteResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? favoriteUri = null}) {
    return _then(
      _value.copyWith(
            favoriteUri: null == favoriteUri
                ? _value.favoriteUri
                : favoriteUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateFavoriteResponseImplCopyWith<$Res>
    implements $CreateFavoriteResponseCopyWith<$Res> {
  factory _$$CreateFavoriteResponseImplCopyWith(
    _$CreateFavoriteResponseImpl value,
    $Res Function(_$CreateFavoriteResponseImpl) then,
  ) = __$$CreateFavoriteResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String favoriteUri});
}

/// @nodoc
class __$$CreateFavoriteResponseImplCopyWithImpl<$Res>
    extends
        _$CreateFavoriteResponseCopyWithImpl<$Res, _$CreateFavoriteResponseImpl>
    implements _$$CreateFavoriteResponseImplCopyWith<$Res> {
  __$$CreateFavoriteResponseImplCopyWithImpl(
    _$CreateFavoriteResponseImpl _value,
    $Res Function(_$CreateFavoriteResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? favoriteUri = null}) {
    return _then(
      _$CreateFavoriteResponseImpl(
        favoriteUri: null == favoriteUri
            ? _value.favoriteUri
            : favoriteUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateFavoriteResponseImpl implements _CreateFavoriteResponse {
  const _$CreateFavoriteResponseImpl({required this.favoriteUri});

  factory _$CreateFavoriteResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateFavoriteResponseImplFromJson(json);

  @override
  final String favoriteUri;

  @override
  String toString() {
    return 'CreateFavoriteResponse(favoriteUri: $favoriteUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateFavoriteResponseImpl &&
            (identical(other.favoriteUri, favoriteUri) ||
                other.favoriteUri == favoriteUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, favoriteUri);

  /// Create a copy of CreateFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateFavoriteResponseImplCopyWith<_$CreateFavoriteResponseImpl>
  get copyWith =>
      __$$CreateFavoriteResponseImplCopyWithImpl<_$CreateFavoriteResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateFavoriteResponseImplToJson(this);
  }
}

abstract class _CreateFavoriteResponse implements CreateFavoriteResponse {
  const factory _CreateFavoriteResponse({required final String favoriteUri}) =
      _$CreateFavoriteResponseImpl;

  factory _CreateFavoriteResponse.fromJson(Map<String, dynamic> json) =
      _$CreateFavoriteResponseImpl.fromJson;

  @override
  String get favoriteUri;

  /// Create a copy of CreateFavoriteResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateFavoriteResponseImplCopyWith<_$CreateFavoriteResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
