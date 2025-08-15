// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_follow_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateFollowResponse _$CreateFollowResponseFromJson(Map<String, dynamic> json) {
  return _CreateFollowResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateFollowResponse {
  String get followUri => throw _privateConstructorUsedError;

  /// Serializes this CreateFollowResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateFollowResponseCopyWith<CreateFollowResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateFollowResponseCopyWith<$Res> {
  factory $CreateFollowResponseCopyWith(
    CreateFollowResponse value,
    $Res Function(CreateFollowResponse) then,
  ) = _$CreateFollowResponseCopyWithImpl<$Res, CreateFollowResponse>;
  @useResult
  $Res call({String followUri});
}

/// @nodoc
class _$CreateFollowResponseCopyWithImpl<
  $Res,
  $Val extends CreateFollowResponse
>
    implements $CreateFollowResponseCopyWith<$Res> {
  _$CreateFollowResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? followUri = null}) {
    return _then(
      _value.copyWith(
            followUri: null == followUri
                ? _value.followUri
                : followUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateFollowResponseImplCopyWith<$Res>
    implements $CreateFollowResponseCopyWith<$Res> {
  factory _$$CreateFollowResponseImplCopyWith(
    _$CreateFollowResponseImpl value,
    $Res Function(_$CreateFollowResponseImpl) then,
  ) = __$$CreateFollowResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String followUri});
}

/// @nodoc
class __$$CreateFollowResponseImplCopyWithImpl<$Res>
    extends _$CreateFollowResponseCopyWithImpl<$Res, _$CreateFollowResponseImpl>
    implements _$$CreateFollowResponseImplCopyWith<$Res> {
  __$$CreateFollowResponseImplCopyWithImpl(
    _$CreateFollowResponseImpl _value,
    $Res Function(_$CreateFollowResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? followUri = null}) {
    return _then(
      _$CreateFollowResponseImpl(
        followUri: null == followUri
            ? _value.followUri
            : followUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateFollowResponseImpl implements _CreateFollowResponse {
  const _$CreateFollowResponseImpl({required this.followUri});

  factory _$CreateFollowResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateFollowResponseImplFromJson(json);

  @override
  final String followUri;

  @override
  String toString() {
    return 'CreateFollowResponse(followUri: $followUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateFollowResponseImpl &&
            (identical(other.followUri, followUri) ||
                other.followUri == followUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, followUri);

  /// Create a copy of CreateFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateFollowResponseImplCopyWith<_$CreateFollowResponseImpl>
  get copyWith =>
      __$$CreateFollowResponseImplCopyWithImpl<_$CreateFollowResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateFollowResponseImplToJson(this);
  }
}

abstract class _CreateFollowResponse implements CreateFollowResponse {
  const factory _CreateFollowResponse({required final String followUri}) =
      _$CreateFollowResponseImpl;

  factory _CreateFollowResponse.fromJson(Map<String, dynamic> json) =
      _$CreateFollowResponseImpl.fromJson;

  @override
  String get followUri;

  /// Create a copy of CreateFollowResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateFollowResponseImplCopyWith<_$CreateFollowResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
