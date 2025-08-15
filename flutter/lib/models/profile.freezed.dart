// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'profile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Profile _$ProfileFromJson(Map<String, dynamic> json) {
  return _Profile.fromJson(json);
}

/// @nodoc
mixin _$Profile {
  String get cid => throw _privateConstructorUsedError;
  String get did => throw _privateConstructorUsedError;
  String get handle => throw _privateConstructorUsedError;
  String? get displayName => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get avatar => throw _privateConstructorUsedError;
  int? get followersCount => throw _privateConstructorUsedError;
  int? get followsCount => throw _privateConstructorUsedError;
  int? get galleryCount => throw _privateConstructorUsedError;
  ProfileViewer? get viewer => throw _privateConstructorUsedError;
  List<String>? get cameras =>
      throw _privateConstructorUsedError; // Added field for description facets used on profile page
  List<Map<String, dynamic>>? get descriptionFacets =>
      throw _privateConstructorUsedError;

  /// Serializes this Profile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfileCopyWith<Profile> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfileCopyWith<$Res> {
  factory $ProfileCopyWith(Profile value, $Res Function(Profile) then) =
      _$ProfileCopyWithImpl<$Res, Profile>;
  @useResult
  $Res call({
    String cid,
    String did,
    String handle,
    String? displayName,
    String? description,
    String? avatar,
    int? followersCount,
    int? followsCount,
    int? galleryCount,
    ProfileViewer? viewer,
    List<String>? cameras,
    List<Map<String, dynamic>>? descriptionFacets,
  });

  $ProfileViewerCopyWith<$Res>? get viewer;
}

/// @nodoc
class _$ProfileCopyWithImpl<$Res, $Val extends Profile>
    implements $ProfileCopyWith<$Res> {
  _$ProfileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cid = null,
    Object? did = null,
    Object? handle = null,
    Object? displayName = freezed,
    Object? description = freezed,
    Object? avatar = freezed,
    Object? followersCount = freezed,
    Object? followsCount = freezed,
    Object? galleryCount = freezed,
    Object? viewer = freezed,
    Object? cameras = freezed,
    Object? descriptionFacets = freezed,
  }) {
    return _then(
      _value.copyWith(
            cid: null == cid
                ? _value.cid
                : cid // ignore: cast_nullable_to_non_nullable
                      as String,
            did: null == did
                ? _value.did
                : did // ignore: cast_nullable_to_non_nullable
                      as String,
            handle: null == handle
                ? _value.handle
                : handle // ignore: cast_nullable_to_non_nullable
                      as String,
            displayName: freezed == displayName
                ? _value.displayName
                : displayName // ignore: cast_nullable_to_non_nullable
                      as String?,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
            avatar: freezed == avatar
                ? _value.avatar
                : avatar // ignore: cast_nullable_to_non_nullable
                      as String?,
            followersCount: freezed == followersCount
                ? _value.followersCount
                : followersCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            followsCount: freezed == followsCount
                ? _value.followsCount
                : followsCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            galleryCount: freezed == galleryCount
                ? _value.galleryCount
                : galleryCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            viewer: freezed == viewer
                ? _value.viewer
                : viewer // ignore: cast_nullable_to_non_nullable
                      as ProfileViewer?,
            cameras: freezed == cameras
                ? _value.cameras
                : cameras // ignore: cast_nullable_to_non_nullable
                      as List<String>?,
            descriptionFacets: freezed == descriptionFacets
                ? _value.descriptionFacets
                : descriptionFacets // ignore: cast_nullable_to_non_nullable
                      as List<Map<String, dynamic>>?,
          )
          as $Val,
    );
  }

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileViewerCopyWith<$Res>? get viewer {
    if (_value.viewer == null) {
      return null;
    }

    return $ProfileViewerCopyWith<$Res>(_value.viewer!, (value) {
      return _then(_value.copyWith(viewer: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ProfileImplCopyWith<$Res> implements $ProfileCopyWith<$Res> {
  factory _$$ProfileImplCopyWith(
    _$ProfileImpl value,
    $Res Function(_$ProfileImpl) then,
  ) = __$$ProfileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String cid,
    String did,
    String handle,
    String? displayName,
    String? description,
    String? avatar,
    int? followersCount,
    int? followsCount,
    int? galleryCount,
    ProfileViewer? viewer,
    List<String>? cameras,
    List<Map<String, dynamic>>? descriptionFacets,
  });

  @override
  $ProfileViewerCopyWith<$Res>? get viewer;
}

/// @nodoc
class __$$ProfileImplCopyWithImpl<$Res>
    extends _$ProfileCopyWithImpl<$Res, _$ProfileImpl>
    implements _$$ProfileImplCopyWith<$Res> {
  __$$ProfileImplCopyWithImpl(
    _$ProfileImpl _value,
    $Res Function(_$ProfileImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cid = null,
    Object? did = null,
    Object? handle = null,
    Object? displayName = freezed,
    Object? description = freezed,
    Object? avatar = freezed,
    Object? followersCount = freezed,
    Object? followsCount = freezed,
    Object? galleryCount = freezed,
    Object? viewer = freezed,
    Object? cameras = freezed,
    Object? descriptionFacets = freezed,
  }) {
    return _then(
      _$ProfileImpl(
        cid: null == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String,
        did: null == did
            ? _value.did
            : did // ignore: cast_nullable_to_non_nullable
                  as String,
        handle: null == handle
            ? _value.handle
            : handle // ignore: cast_nullable_to_non_nullable
                  as String,
        displayName: freezed == displayName
            ? _value.displayName
            : displayName // ignore: cast_nullable_to_non_nullable
                  as String?,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        avatar: freezed == avatar
            ? _value.avatar
            : avatar // ignore: cast_nullable_to_non_nullable
                  as String?,
        followersCount: freezed == followersCount
            ? _value.followersCount
            : followersCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        followsCount: freezed == followsCount
            ? _value.followsCount
            : followsCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        galleryCount: freezed == galleryCount
            ? _value.galleryCount
            : galleryCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        viewer: freezed == viewer
            ? _value.viewer
            : viewer // ignore: cast_nullable_to_non_nullable
                  as ProfileViewer?,
        cameras: freezed == cameras
            ? _value._cameras
            : cameras // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
        descriptionFacets: freezed == descriptionFacets
            ? _value._descriptionFacets
            : descriptionFacets // ignore: cast_nullable_to_non_nullable
                  as List<Map<String, dynamic>>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ProfileImpl implements _Profile {
  const _$ProfileImpl({
    required this.cid,
    required this.did,
    required this.handle,
    this.displayName,
    this.description,
    this.avatar,
    this.followersCount,
    this.followsCount,
    this.galleryCount,
    this.viewer,
    final List<String>? cameras,
    final List<Map<String, dynamic>>? descriptionFacets,
  }) : _cameras = cameras,
       _descriptionFacets = descriptionFacets;

  factory _$ProfileImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProfileImplFromJson(json);

  @override
  final String cid;
  @override
  final String did;
  @override
  final String handle;
  @override
  final String? displayName;
  @override
  final String? description;
  @override
  final String? avatar;
  @override
  final int? followersCount;
  @override
  final int? followsCount;
  @override
  final int? galleryCount;
  @override
  final ProfileViewer? viewer;
  final List<String>? _cameras;
  @override
  List<String>? get cameras {
    final value = _cameras;
    if (value == null) return null;
    if (_cameras is EqualUnmodifiableListView) return _cameras;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  // Added field for description facets used on profile page
  final List<Map<String, dynamic>>? _descriptionFacets;
  // Added field for description facets used on profile page
  @override
  List<Map<String, dynamic>>? get descriptionFacets {
    final value = _descriptionFacets;
    if (value == null) return null;
    if (_descriptionFacets is EqualUnmodifiableListView)
      return _descriptionFacets;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'Profile(cid: $cid, did: $did, handle: $handle, displayName: $displayName, description: $description, avatar: $avatar, followersCount: $followersCount, followsCount: $followsCount, galleryCount: $galleryCount, viewer: $viewer, cameras: $cameras, descriptionFacets: $descriptionFacets)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfileImpl &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.did, did) || other.did == did) &&
            (identical(other.handle, handle) || other.handle == handle) &&
            (identical(other.displayName, displayName) ||
                other.displayName == displayName) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.avatar, avatar) || other.avatar == avatar) &&
            (identical(other.followersCount, followersCount) ||
                other.followersCount == followersCount) &&
            (identical(other.followsCount, followsCount) ||
                other.followsCount == followsCount) &&
            (identical(other.galleryCount, galleryCount) ||
                other.galleryCount == galleryCount) &&
            (identical(other.viewer, viewer) || other.viewer == viewer) &&
            const DeepCollectionEquality().equals(other._cameras, _cameras) &&
            const DeepCollectionEquality().equals(
              other._descriptionFacets,
              _descriptionFacets,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    cid,
    did,
    handle,
    displayName,
    description,
    avatar,
    followersCount,
    followsCount,
    galleryCount,
    viewer,
    const DeepCollectionEquality().hash(_cameras),
    const DeepCollectionEquality().hash(_descriptionFacets),
  );

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfileImplCopyWith<_$ProfileImpl> get copyWith =>
      __$$ProfileImplCopyWithImpl<_$ProfileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProfileImplToJson(this);
  }
}

abstract class _Profile implements Profile {
  const factory _Profile({
    required final String cid,
    required final String did,
    required final String handle,
    final String? displayName,
    final String? description,
    final String? avatar,
    final int? followersCount,
    final int? followsCount,
    final int? galleryCount,
    final ProfileViewer? viewer,
    final List<String>? cameras,
    final List<Map<String, dynamic>>? descriptionFacets,
  }) = _$ProfileImpl;

  factory _Profile.fromJson(Map<String, dynamic> json) = _$ProfileImpl.fromJson;

  @override
  String get cid;
  @override
  String get did;
  @override
  String get handle;
  @override
  String? get displayName;
  @override
  String? get description;
  @override
  String? get avatar;
  @override
  int? get followersCount;
  @override
  int? get followsCount;
  @override
  int? get galleryCount;
  @override
  ProfileViewer? get viewer;
  @override
  List<String>? get cameras; // Added field for description facets used on profile page
  @override
  List<Map<String, dynamic>>? get descriptionFacets;

  /// Create a copy of Profile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfileImplCopyWith<_$ProfileImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
