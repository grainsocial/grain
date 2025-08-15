// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'followers_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

FollowersResult _$FollowersResultFromJson(Map<String, dynamic> json) {
  return _FollowersResult.fromJson(json);
}

/// @nodoc
mixin _$FollowersResult {
  dynamic get subject => throw _privateConstructorUsedError;
  List<Profile> get followers => throw _privateConstructorUsedError;
  String? get cursor => throw _privateConstructorUsedError;

  /// Serializes this FollowersResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FollowersResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FollowersResultCopyWith<FollowersResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FollowersResultCopyWith<$Res> {
  factory $FollowersResultCopyWith(
    FollowersResult value,
    $Res Function(FollowersResult) then,
  ) = _$FollowersResultCopyWithImpl<$Res, FollowersResult>;
  @useResult
  $Res call({dynamic subject, List<Profile> followers, String? cursor});
}

/// @nodoc
class _$FollowersResultCopyWithImpl<$Res, $Val extends FollowersResult>
    implements $FollowersResultCopyWith<$Res> {
  _$FollowersResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FollowersResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subject = freezed,
    Object? followers = null,
    Object? cursor = freezed,
  }) {
    return _then(
      _value.copyWith(
            subject: freezed == subject
                ? _value.subject
                : subject // ignore: cast_nullable_to_non_nullable
                      as dynamic,
            followers: null == followers
                ? _value.followers
                : followers // ignore: cast_nullable_to_non_nullable
                      as List<Profile>,
            cursor: freezed == cursor
                ? _value.cursor
                : cursor // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$FollowersResultImplCopyWith<$Res>
    implements $FollowersResultCopyWith<$Res> {
  factory _$$FollowersResultImplCopyWith(
    _$FollowersResultImpl value,
    $Res Function(_$FollowersResultImpl) then,
  ) = __$$FollowersResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({dynamic subject, List<Profile> followers, String? cursor});
}

/// @nodoc
class __$$FollowersResultImplCopyWithImpl<$Res>
    extends _$FollowersResultCopyWithImpl<$Res, _$FollowersResultImpl>
    implements _$$FollowersResultImplCopyWith<$Res> {
  __$$FollowersResultImplCopyWithImpl(
    _$FollowersResultImpl _value,
    $Res Function(_$FollowersResultImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of FollowersResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subject = freezed,
    Object? followers = null,
    Object? cursor = freezed,
  }) {
    return _then(
      _$FollowersResultImpl(
        subject: freezed == subject
            ? _value.subject
            : subject // ignore: cast_nullable_to_non_nullable
                  as dynamic,
        followers: null == followers
            ? _value._followers
            : followers // ignore: cast_nullable_to_non_nullable
                  as List<Profile>,
        cursor: freezed == cursor
            ? _value.cursor
            : cursor // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$FollowersResultImpl implements _FollowersResult {
  const _$FollowersResultImpl({
    required this.subject,
    required final List<Profile> followers,
    this.cursor,
  }) : _followers = followers;

  factory _$FollowersResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$FollowersResultImplFromJson(json);

  @override
  final dynamic subject;
  final List<Profile> _followers;
  @override
  List<Profile> get followers {
    if (_followers is EqualUnmodifiableListView) return _followers;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_followers);
  }

  @override
  final String? cursor;

  @override
  String toString() {
    return 'FollowersResult(subject: $subject, followers: $followers, cursor: $cursor)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FollowersResultImpl &&
            const DeepCollectionEquality().equals(other.subject, subject) &&
            const DeepCollectionEquality().equals(
              other._followers,
              _followers,
            ) &&
            (identical(other.cursor, cursor) || other.cursor == cursor));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(subject),
    const DeepCollectionEquality().hash(_followers),
    cursor,
  );

  /// Create a copy of FollowersResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FollowersResultImplCopyWith<_$FollowersResultImpl> get copyWith =>
      __$$FollowersResultImplCopyWithImpl<_$FollowersResultImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$FollowersResultImplToJson(this);
  }
}

abstract class _FollowersResult implements FollowersResult {
  const factory _FollowersResult({
    required final dynamic subject,
    required final List<Profile> followers,
    final String? cursor,
  }) = _$FollowersResultImpl;

  factory _FollowersResult.fromJson(Map<String, dynamic> json) =
      _$FollowersResultImpl.fromJson;

  @override
  dynamic get subject;
  @override
  List<Profile> get followers;
  @override
  String? get cursor;

  /// Create a copy of FollowersResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FollowersResultImplCopyWith<_$FollowersResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
