// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_follow_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateFollowRequest _$CreateFollowRequestFromJson(Map<String, dynamic> json) {
  return _CreateFollowRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateFollowRequest {
  String get subject => throw _privateConstructorUsedError;

  /// Serializes this CreateFollowRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateFollowRequestCopyWith<CreateFollowRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateFollowRequestCopyWith<$Res> {
  factory $CreateFollowRequestCopyWith(
    CreateFollowRequest value,
    $Res Function(CreateFollowRequest) then,
  ) = _$CreateFollowRequestCopyWithImpl<$Res, CreateFollowRequest>;
  @useResult
  $Res call({String subject});
}

/// @nodoc
class _$CreateFollowRequestCopyWithImpl<$Res, $Val extends CreateFollowRequest>
    implements $CreateFollowRequestCopyWith<$Res> {
  _$CreateFollowRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateFollowRequest
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
abstract class _$$CreateFollowRequestImplCopyWith<$Res>
    implements $CreateFollowRequestCopyWith<$Res> {
  factory _$$CreateFollowRequestImplCopyWith(
    _$CreateFollowRequestImpl value,
    $Res Function(_$CreateFollowRequestImpl) then,
  ) = __$$CreateFollowRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String subject});
}

/// @nodoc
class __$$CreateFollowRequestImplCopyWithImpl<$Res>
    extends _$CreateFollowRequestCopyWithImpl<$Res, _$CreateFollowRequestImpl>
    implements _$$CreateFollowRequestImplCopyWith<$Res> {
  __$$CreateFollowRequestImplCopyWithImpl(
    _$CreateFollowRequestImpl _value,
    $Res Function(_$CreateFollowRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? subject = null}) {
    return _then(
      _$CreateFollowRequestImpl(
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
class _$CreateFollowRequestImpl implements _CreateFollowRequest {
  const _$CreateFollowRequestImpl({required this.subject});

  factory _$CreateFollowRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateFollowRequestImplFromJson(json);

  @override
  final String subject;

  @override
  String toString() {
    return 'CreateFollowRequest(subject: $subject)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateFollowRequestImpl &&
            (identical(other.subject, subject) || other.subject == subject));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subject);

  /// Create a copy of CreateFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateFollowRequestImplCopyWith<_$CreateFollowRequestImpl> get copyWith =>
      __$$CreateFollowRequestImplCopyWithImpl<_$CreateFollowRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateFollowRequestImplToJson(this);
  }
}

abstract class _CreateFollowRequest implements CreateFollowRequest {
  const factory _CreateFollowRequest({required final String subject}) =
      _$CreateFollowRequestImpl;

  factory _CreateFollowRequest.fromJson(Map<String, dynamic> json) =
      _$CreateFollowRequestImpl.fromJson;

  @override
  String get subject;

  /// Create a copy of CreateFollowRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateFollowRequestImplCopyWith<_$CreateFollowRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
