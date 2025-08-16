// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_favorite_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateFavoriteRequest _$CreateFavoriteRequestFromJson(
  Map<String, dynamic> json,
) {
  return _CreateFavoriteRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateFavoriteRequest {
  String get subject => throw _privateConstructorUsedError;

  /// Serializes this CreateFavoriteRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateFavoriteRequestCopyWith<CreateFavoriteRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateFavoriteRequestCopyWith<$Res> {
  factory $CreateFavoriteRequestCopyWith(
    CreateFavoriteRequest value,
    $Res Function(CreateFavoriteRequest) then,
  ) = _$CreateFavoriteRequestCopyWithImpl<$Res, CreateFavoriteRequest>;
  @useResult
  $Res call({String subject});
}

/// @nodoc
class _$CreateFavoriteRequestCopyWithImpl<
  $Res,
  $Val extends CreateFavoriteRequest
>
    implements $CreateFavoriteRequestCopyWith<$Res> {
  _$CreateFavoriteRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? subject = null}) {
    return _then(
      _value.copyWith(
            subject: null == subject
                ? _value.subject
                : subject // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateFavoriteRequestImplCopyWith<$Res>
    implements $CreateFavoriteRequestCopyWith<$Res> {
  factory _$$CreateFavoriteRequestImplCopyWith(
    _$CreateFavoriteRequestImpl value,
    $Res Function(_$CreateFavoriteRequestImpl) then,
  ) = __$$CreateFavoriteRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String subject});
}

/// @nodoc
class __$$CreateFavoriteRequestImplCopyWithImpl<$Res>
    extends
        _$CreateFavoriteRequestCopyWithImpl<$Res, _$CreateFavoriteRequestImpl>
    implements _$$CreateFavoriteRequestImplCopyWith<$Res> {
  __$$CreateFavoriteRequestImplCopyWithImpl(
    _$CreateFavoriteRequestImpl _value,
    $Res Function(_$CreateFavoriteRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? subject = null}) {
    return _then(
      _$CreateFavoriteRequestImpl(
        subject: null == subject
            ? _value.subject
            : subject // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateFavoriteRequestImpl implements _CreateFavoriteRequest {
  const _$CreateFavoriteRequestImpl({required this.subject});

  factory _$CreateFavoriteRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateFavoriteRequestImplFromJson(json);

  @override
  final String subject;

  @override
  String toString() {
    return 'CreateFavoriteRequest(subject: $subject)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateFavoriteRequestImpl &&
            (identical(other.subject, subject) || other.subject == subject));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subject);

  /// Create a copy of CreateFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateFavoriteRequestImplCopyWith<_$CreateFavoriteRequestImpl>
  get copyWith =>
      __$$CreateFavoriteRequestImplCopyWithImpl<_$CreateFavoriteRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateFavoriteRequestImplToJson(this);
  }
}

abstract class _CreateFavoriteRequest implements CreateFavoriteRequest {
  const factory _CreateFavoriteRequest({required final String subject}) =
      _$CreateFavoriteRequestImpl;

  factory _CreateFavoriteRequest.fromJson(Map<String, dynamic> json) =
      _$CreateFavoriteRequestImpl.fromJson;

  @override
  String get subject;

  /// Create a copy of CreateFavoriteRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateFavoriteRequestImplCopyWith<_$CreateFavoriteRequestImpl>
  get copyWith => throw _privateConstructorUsedError;
}
