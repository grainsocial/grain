// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'profile_with_galleries.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ProfileWithGalleries _$ProfileWithGalleriesFromJson(Map<String, dynamic> json) {
  return _ProfileWithGalleries.fromJson(json);
}

/// @nodoc
mixin _$ProfileWithGalleries {
  Profile get profile => throw _privateConstructorUsedError;
  List<Gallery> get galleries => throw _privateConstructorUsedError;
  List<Gallery>? get favs => throw _privateConstructorUsedError;

  /// Serializes this ProfileWithGalleries to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfileWithGalleriesCopyWith<ProfileWithGalleries> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfileWithGalleriesCopyWith<$Res> {
  factory $ProfileWithGalleriesCopyWith(
    ProfileWithGalleries value,
    $Res Function(ProfileWithGalleries) then,
  ) = _$ProfileWithGalleriesCopyWithImpl<$Res, ProfileWithGalleries>;
  @useResult
  $Res call({Profile profile, List<Gallery> galleries, List<Gallery>? favs});

  $ProfileCopyWith<$Res> get profile;
}

/// @nodoc
class _$ProfileWithGalleriesCopyWithImpl<
  $Res,
  $Val extends ProfileWithGalleries
>
    implements $ProfileWithGalleriesCopyWith<$Res> {
  _$ProfileWithGalleriesCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? profile = null,
    Object? galleries = null,
    Object? favs = freezed,
  }) {
    return _then(
      _value.copyWith(
            profile: null == profile
                ? _value.profile
                : profile // ignore: cast_nullable_to_non_nullable
                      as Profile,
            galleries: null == galleries
                ? _value.galleries
                : galleries // ignore: cast_nullable_to_non_nullable
                      as List<Gallery>,
            favs: freezed == favs
                ? _value.favs
                : favs // ignore: cast_nullable_to_non_nullable
                      as List<Gallery>?,
          )
          as $Val,
    );
  }

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileCopyWith<$Res> get profile {
    return $ProfileCopyWith<$Res>(_value.profile, (value) {
      return _then(_value.copyWith(profile: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ProfileWithGalleriesImplCopyWith<$Res>
    implements $ProfileWithGalleriesCopyWith<$Res> {
  factory _$$ProfileWithGalleriesImplCopyWith(
    _$ProfileWithGalleriesImpl value,
    $Res Function(_$ProfileWithGalleriesImpl) then,
  ) = __$$ProfileWithGalleriesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({Profile profile, List<Gallery> galleries, List<Gallery>? favs});

  @override
  $ProfileCopyWith<$Res> get profile;
}

/// @nodoc
class __$$ProfileWithGalleriesImplCopyWithImpl<$Res>
    extends _$ProfileWithGalleriesCopyWithImpl<$Res, _$ProfileWithGalleriesImpl>
    implements _$$ProfileWithGalleriesImplCopyWith<$Res> {
  __$$ProfileWithGalleriesImplCopyWithImpl(
    _$ProfileWithGalleriesImpl _value,
    $Res Function(_$ProfileWithGalleriesImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? profile = null,
    Object? galleries = null,
    Object? favs = freezed,
  }) {
    return _then(
      _$ProfileWithGalleriesImpl(
        profile: null == profile
            ? _value.profile
            : profile // ignore: cast_nullable_to_non_nullable
                  as Profile,
        galleries: null == galleries
            ? _value._galleries
            : galleries // ignore: cast_nullable_to_non_nullable
                  as List<Gallery>,
        favs: freezed == favs
            ? _value._favs
            : favs // ignore: cast_nullable_to_non_nullable
                  as List<Gallery>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ProfileWithGalleriesImpl implements _ProfileWithGalleries {
  const _$ProfileWithGalleriesImpl({
    required this.profile,
    required final List<Gallery> galleries,
    final List<Gallery>? favs,
  }) : _galleries = galleries,
       _favs = favs;

  factory _$ProfileWithGalleriesImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProfileWithGalleriesImplFromJson(json);

  @override
  final Profile profile;
  final List<Gallery> _galleries;
  @override
  List<Gallery> get galleries {
    if (_galleries is EqualUnmodifiableListView) return _galleries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_galleries);
  }

  final List<Gallery>? _favs;
  @override
  List<Gallery>? get favs {
    final value = _favs;
    if (value == null) return null;
    if (_favs is EqualUnmodifiableListView) return _favs;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'ProfileWithGalleries(profile: $profile, galleries: $galleries, favs: $favs)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfileWithGalleriesImpl &&
            (identical(other.profile, profile) || other.profile == profile) &&
            const DeepCollectionEquality().equals(
              other._galleries,
              _galleries,
            ) &&
            const DeepCollectionEquality().equals(other._favs, _favs));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    profile,
    const DeepCollectionEquality().hash(_galleries),
    const DeepCollectionEquality().hash(_favs),
  );

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfileWithGalleriesImplCopyWith<_$ProfileWithGalleriesImpl>
  get copyWith =>
      __$$ProfileWithGalleriesImplCopyWithImpl<_$ProfileWithGalleriesImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ProfileWithGalleriesImplToJson(this);
  }
}

abstract class _ProfileWithGalleries implements ProfileWithGalleries {
  const factory _ProfileWithGalleries({
    required final Profile profile,
    required final List<Gallery> galleries,
    final List<Gallery>? favs,
  }) = _$ProfileWithGalleriesImpl;

  factory _ProfileWithGalleries.fromJson(Map<String, dynamic> json) =
      _$ProfileWithGalleriesImpl.fromJson;

  @override
  Profile get profile;
  @override
  List<Gallery> get galleries;
  @override
  List<Gallery>? get favs;

  /// Create a copy of ProfileWithGalleries
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfileWithGalleriesImplCopyWith<_$ProfileWithGalleriesImpl>
  get copyWith => throw _privateConstructorUsedError;
}
