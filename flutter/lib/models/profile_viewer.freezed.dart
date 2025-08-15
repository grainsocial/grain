// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'profile_viewer.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ProfileViewer _$ProfileViewerFromJson(Map<String, dynamic> json) {
  return _ProfileViewer.fromJson(json);
}

/// @nodoc
mixin _$ProfileViewer {
  String? get following => throw _privateConstructorUsedError;
  String? get followedBy => throw _privateConstructorUsedError;

  /// Serializes this ProfileViewer to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProfileViewer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfileViewerCopyWith<ProfileViewer> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfileViewerCopyWith<$Res> {
  factory $ProfileViewerCopyWith(
    ProfileViewer value,
    $Res Function(ProfileViewer) then,
  ) = _$ProfileViewerCopyWithImpl<$Res, ProfileViewer>;
  @useResult
  $Res call({String? following, String? followedBy});
}

/// @nodoc
class _$ProfileViewerCopyWithImpl<$Res, $Val extends ProfileViewer>
    implements $ProfileViewerCopyWith<$Res> {
  _$ProfileViewerCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProfileViewer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? following = freezed, Object? followedBy = freezed}) {
    return _then(
      _value.copyWith(
            following: freezed == following
                ? _value.following
                : following // ignore: cast_nullable_to_non_nullable
                      as String?,
            followedBy: freezed == followedBy
                ? _value.followedBy
                : followedBy // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ProfileViewerImplCopyWith<$Res>
    implements $ProfileViewerCopyWith<$Res> {
  factory _$$ProfileViewerImplCopyWith(
    _$ProfileViewerImpl value,
    $Res Function(_$ProfileViewerImpl) then,
  ) = __$$ProfileViewerImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String? following, String? followedBy});
}

/// @nodoc
class __$$ProfileViewerImplCopyWithImpl<$Res>
    extends _$ProfileViewerCopyWithImpl<$Res, _$ProfileViewerImpl>
    implements _$$ProfileViewerImplCopyWith<$Res> {
  __$$ProfileViewerImplCopyWithImpl(
    _$ProfileViewerImpl _value,
    $Res Function(_$ProfileViewerImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ProfileViewer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? following = freezed, Object? followedBy = freezed}) {
    return _then(
      _$ProfileViewerImpl(
        following: freezed == following
            ? _value.following
            : following // ignore: cast_nullable_to_non_nullable
                  as String?,
        followedBy: freezed == followedBy
            ? _value.followedBy
            : followedBy // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ProfileViewerImpl implements _ProfileViewer {
  const _$ProfileViewerImpl({this.following, this.followedBy});

  factory _$ProfileViewerImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProfileViewerImplFromJson(json);

  @override
  final String? following;
  @override
  final String? followedBy;

  @override
  String toString() {
    return 'ProfileViewer(following: $following, followedBy: $followedBy)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfileViewerImpl &&
            (identical(other.following, following) ||
                other.following == following) &&
            (identical(other.followedBy, followedBy) ||
                other.followedBy == followedBy));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, following, followedBy);

  /// Create a copy of ProfileViewer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfileViewerImplCopyWith<_$ProfileViewerImpl> get copyWith =>
      __$$ProfileViewerImplCopyWithImpl<_$ProfileViewerImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProfileViewerImplToJson(this);
  }
}

abstract class _ProfileViewer implements ProfileViewer {
  const factory _ProfileViewer({
    final String? following,
    final String? followedBy,
  }) = _$ProfileViewerImpl;

  factory _ProfileViewer.fromJson(Map<String, dynamic> json) =
      _$ProfileViewerImpl.fromJson;

  @override
  String? get following;
  @override
  String? get followedBy;

  /// Create a copy of ProfileViewer
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfileViewerImplCopyWith<_$ProfileViewerImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
