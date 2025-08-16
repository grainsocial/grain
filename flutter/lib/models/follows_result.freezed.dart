// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'follows_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

FollowsResult _$FollowsResultFromJson(Map<String, dynamic> json) {
  return _FollowsResult.fromJson(json);
}

/// @nodoc
mixin _$FollowsResult {
  dynamic get subject => throw _privateConstructorUsedError;
  List<Profile> get follows => throw _privateConstructorUsedError;
  String? get cursor => throw _privateConstructorUsedError;

  /// Serializes this FollowsResult to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FollowsResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FollowsResultCopyWith<FollowsResult> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FollowsResultCopyWith<$Res> {
  factory $FollowsResultCopyWith(
    FollowsResult value,
    $Res Function(FollowsResult) then,
  ) = _$FollowsResultCopyWithImpl<$Res, FollowsResult>;
  @useResult
  $Res call({dynamic subject, List<Profile> follows, String? cursor});
}

/// @nodoc
class _$FollowsResultCopyWithImpl<$Res, $Val extends FollowsResult>
    implements $FollowsResultCopyWith<$Res> {
  _$FollowsResultCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FollowsResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subject = freezed,
    Object? follows = null,
    Object? cursor = freezed,
  }) {
    return _then(
      _value.copyWith(
            subject: freezed == subject
                ? _value.subject
                : subject // ignore: cast_nullable_to_non_nullable
                      as dynamic,
            follows: null == follows
                ? _value.follows
                : follows // ignore: cast_nullable_to_non_nullable
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
abstract class _$$FollowsResultImplCopyWith<$Res>
    implements $FollowsResultCopyWith<$Res> {
  factory _$$FollowsResultImplCopyWith(
    _$FollowsResultImpl value,
    $Res Function(_$FollowsResultImpl) then,
  ) = __$$FollowsResultImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({dynamic subject, List<Profile> follows, String? cursor});
}

/// @nodoc
class __$$FollowsResultImplCopyWithImpl<$Res>
    extends _$FollowsResultCopyWithImpl<$Res, _$FollowsResultImpl>
    implements _$$FollowsResultImplCopyWith<$Res> {
  __$$FollowsResultImplCopyWithImpl(
    _$FollowsResultImpl _value,
    $Res Function(_$FollowsResultImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of FollowsResult
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subject = freezed,
    Object? follows = null,
    Object? cursor = freezed,
  }) {
    return _then(
      _$FollowsResultImpl(
        subject: freezed == subject
            ? _value.subject
            : subject // ignore: cast_nullable_to_non_nullable
                  as dynamic,
        follows: null == follows
            ? _value._follows
            : follows // ignore: cast_nullable_to_non_nullable
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
class _$FollowsResultImpl implements _FollowsResult {
  const _$FollowsResultImpl({
    required this.subject,
    required final List<Profile> follows,
    this.cursor,
  }) : _follows = follows;

  factory _$FollowsResultImpl.fromJson(Map<String, dynamic> json) =>
      _$$FollowsResultImplFromJson(json);

  @override
  final dynamic subject;
  final List<Profile> _follows;
  @override
  List<Profile> get follows {
    if (_follows is EqualUnmodifiableListView) return _follows;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_follows);
  }

  @override
  final String? cursor;

  @override
  String toString() {
    return 'FollowsResult(subject: $subject, follows: $follows, cursor: $cursor)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FollowsResultImpl &&
            const DeepCollectionEquality().equals(other.subject, subject) &&
            const DeepCollectionEquality().equals(other._follows, _follows) &&
            (identical(other.cursor, cursor) || other.cursor == cursor));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(subject),
    const DeepCollectionEquality().hash(_follows),
    cursor,
  );

  /// Create a copy of FollowsResult
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FollowsResultImplCopyWith<_$FollowsResultImpl> get copyWith =>
      __$$FollowsResultImplCopyWithImpl<_$FollowsResultImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FollowsResultImplToJson(this);
  }
}

abstract class _FollowsResult implements FollowsResult {
  const factory _FollowsResult({
    required final dynamic subject,
    required final List<Profile> follows,
    final String? cursor,
  }) = _$FollowsResultImpl;

  factory _FollowsResult.fromJson(Map<String, dynamic> json) =
      _$FollowsResultImpl.fromJson;

  @override
  dynamic get subject;
  @override
  List<Profile> get follows;
  @override
  String? get cursor;

  /// Create a copy of FollowsResult
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FollowsResultImplCopyWith<_$FollowsResultImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
