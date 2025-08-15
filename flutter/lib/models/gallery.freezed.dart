// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gallery.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Gallery _$GalleryFromJson(Map<String, dynamic> json) {
  return _Gallery.fromJson(json);
}

/// @nodoc
mixin _$Gallery {
  String get uri => throw _privateConstructorUsedError;
  String get cid => throw _privateConstructorUsedError;
  String? get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  List<GalleryPhoto> get items => throw _privateConstructorUsedError;
  Profile? get creator => throw _privateConstructorUsedError;
  String? get createdAt => throw _privateConstructorUsedError;
  int? get favCount => throw _privateConstructorUsedError;
  int? get commentCount => throw _privateConstructorUsedError;
  GalleryViewer? get viewer => throw _privateConstructorUsedError;
  List<Map<String, dynamic>>? get facets => throw _privateConstructorUsedError;
  List<String>? get cameras => throw _privateConstructorUsedError;

  /// Serializes this Gallery to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GalleryCopyWith<Gallery> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GalleryCopyWith<$Res> {
  factory $GalleryCopyWith(Gallery value, $Res Function(Gallery) then) =
      _$GalleryCopyWithImpl<$Res, Gallery>;
  @useResult
  $Res call({
    String uri,
    String cid,
    String? title,
    String? description,
    List<GalleryPhoto> items,
    Profile? creator,
    String? createdAt,
    int? favCount,
    int? commentCount,
    GalleryViewer? viewer,
    List<Map<String, dynamic>>? facets,
    List<String>? cameras,
  });

  $ProfileCopyWith<$Res>? get creator;
  $GalleryViewerCopyWith<$Res>? get viewer;
}

/// @nodoc
class _$GalleryCopyWithImpl<$Res, $Val extends Gallery>
    implements $GalleryCopyWith<$Res> {
  _$GalleryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? title = freezed,
    Object? description = freezed,
    Object? items = null,
    Object? creator = freezed,
    Object? createdAt = freezed,
    Object? favCount = freezed,
    Object? commentCount = freezed,
    Object? viewer = freezed,
    Object? facets = freezed,
    Object? cameras = freezed,
  }) {
    return _then(
      _value.copyWith(
            uri: null == uri
                ? _value.uri
                : uri // ignore: cast_nullable_to_non_nullable
                      as String,
            cid: null == cid
                ? _value.cid
                : cid // ignore: cast_nullable_to_non_nullable
                      as String,
            title: freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String?,
            description: freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                      as String?,
            items: null == items
                ? _value.items
                : items // ignore: cast_nullable_to_non_nullable
                      as List<GalleryPhoto>,
            creator: freezed == creator
                ? _value.creator
                : creator // ignore: cast_nullable_to_non_nullable
                      as Profile?,
            createdAt: freezed == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as String?,
            favCount: freezed == favCount
                ? _value.favCount
                : favCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            commentCount: freezed == commentCount
                ? _value.commentCount
                : commentCount // ignore: cast_nullable_to_non_nullable
                      as int?,
            viewer: freezed == viewer
                ? _value.viewer
                : viewer // ignore: cast_nullable_to_non_nullable
                      as GalleryViewer?,
            facets: freezed == facets
                ? _value.facets
                : facets // ignore: cast_nullable_to_non_nullable
                      as List<Map<String, dynamic>>?,
            cameras: freezed == cameras
                ? _value.cameras
                : cameras // ignore: cast_nullable_to_non_nullable
                      as List<String>?,
          )
          as $Val,
    );
  }

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileCopyWith<$Res>? get creator {
    if (_value.creator == null) {
      return null;
    }

    return $ProfileCopyWith<$Res>(_value.creator!, (value) {
      return _then(_value.copyWith(creator: value) as $Val);
    });
  }

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryViewerCopyWith<$Res>? get viewer {
    if (_value.viewer == null) {
      return null;
    }

    return $GalleryViewerCopyWith<$Res>(_value.viewer!, (value) {
      return _then(_value.copyWith(viewer: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$GalleryImplCopyWith<$Res> implements $GalleryCopyWith<$Res> {
  factory _$$GalleryImplCopyWith(
    _$GalleryImpl value,
    $Res Function(_$GalleryImpl) then,
  ) = __$$GalleryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String uri,
    String cid,
    String? title,
    String? description,
    List<GalleryPhoto> items,
    Profile? creator,
    String? createdAt,
    int? favCount,
    int? commentCount,
    GalleryViewer? viewer,
    List<Map<String, dynamic>>? facets,
    List<String>? cameras,
  });

  @override
  $ProfileCopyWith<$Res>? get creator;
  @override
  $GalleryViewerCopyWith<$Res>? get viewer;
}

/// @nodoc
class __$$GalleryImplCopyWithImpl<$Res>
    extends _$GalleryCopyWithImpl<$Res, _$GalleryImpl>
    implements _$$GalleryImplCopyWith<$Res> {
  __$$GalleryImplCopyWithImpl(
    _$GalleryImpl _value,
    $Res Function(_$GalleryImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? title = freezed,
    Object? description = freezed,
    Object? items = null,
    Object? creator = freezed,
    Object? createdAt = freezed,
    Object? favCount = freezed,
    Object? commentCount = freezed,
    Object? viewer = freezed,
    Object? facets = freezed,
    Object? cameras = freezed,
  }) {
    return _then(
      _$GalleryImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
        cid: null == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String,
        title: freezed == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String?,
        description: freezed == description
            ? _value.description
            : description // ignore: cast_nullable_to_non_nullable
                  as String?,
        items: null == items
            ? _value._items
            : items // ignore: cast_nullable_to_non_nullable
                  as List<GalleryPhoto>,
        creator: freezed == creator
            ? _value.creator
            : creator // ignore: cast_nullable_to_non_nullable
                  as Profile?,
        createdAt: freezed == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as String?,
        favCount: freezed == favCount
            ? _value.favCount
            : favCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        commentCount: freezed == commentCount
            ? _value.commentCount
            : commentCount // ignore: cast_nullable_to_non_nullable
                  as int?,
        viewer: freezed == viewer
            ? _value.viewer
            : viewer // ignore: cast_nullable_to_non_nullable
                  as GalleryViewer?,
        facets: freezed == facets
            ? _value._facets
            : facets // ignore: cast_nullable_to_non_nullable
                  as List<Map<String, dynamic>>?,
        cameras: freezed == cameras
            ? _value._cameras
            : cameras // ignore: cast_nullable_to_non_nullable
                  as List<String>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GalleryImpl implements _Gallery {
  const _$GalleryImpl({
    required this.uri,
    required this.cid,
    this.title,
    this.description,
    required final List<GalleryPhoto> items,
    this.creator,
    this.createdAt,
    this.favCount,
    this.commentCount,
    this.viewer,
    final List<Map<String, dynamic>>? facets,
    final List<String>? cameras,
  }) : _items = items,
       _facets = facets,
       _cameras = cameras;

  factory _$GalleryImpl.fromJson(Map<String, dynamic> json) =>
      _$$GalleryImplFromJson(json);

  @override
  final String uri;
  @override
  final String cid;
  @override
  final String? title;
  @override
  final String? description;
  final List<GalleryPhoto> _items;
  @override
  List<GalleryPhoto> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final Profile? creator;
  @override
  final String? createdAt;
  @override
  final int? favCount;
  @override
  final int? commentCount;
  @override
  final GalleryViewer? viewer;
  final List<Map<String, dynamic>>? _facets;
  @override
  List<Map<String, dynamic>>? get facets {
    final value = _facets;
    if (value == null) return null;
    if (_facets is EqualUnmodifiableListView) return _facets;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  final List<String>? _cameras;
  @override
  List<String>? get cameras {
    final value = _cameras;
    if (value == null) return null;
    if (_cameras is EqualUnmodifiableListView) return _cameras;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'Gallery(uri: $uri, cid: $cid, title: $title, description: $description, items: $items, creator: $creator, createdAt: $createdAt, favCount: $favCount, commentCount: $commentCount, viewer: $viewer, facets: $facets, cameras: $cameras)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GalleryImpl &&
            (identical(other.uri, uri) || other.uri == uri) &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.creator, creator) || other.creator == creator) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.favCount, favCount) ||
                other.favCount == favCount) &&
            (identical(other.commentCount, commentCount) ||
                other.commentCount == commentCount) &&
            (identical(other.viewer, viewer) || other.viewer == viewer) &&
            const DeepCollectionEquality().equals(other._facets, _facets) &&
            const DeepCollectionEquality().equals(other._cameras, _cameras));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    uri,
    cid,
    title,
    description,
    const DeepCollectionEquality().hash(_items),
    creator,
    createdAt,
    favCount,
    commentCount,
    viewer,
    const DeepCollectionEquality().hash(_facets),
    const DeepCollectionEquality().hash(_cameras),
  );

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GalleryImplCopyWith<_$GalleryImpl> get copyWith =>
      __$$GalleryImplCopyWithImpl<_$GalleryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GalleryImplToJson(this);
  }
}

abstract class _Gallery implements Gallery {
  const factory _Gallery({
    required final String uri,
    required final String cid,
    final String? title,
    final String? description,
    required final List<GalleryPhoto> items,
    final Profile? creator,
    final String? createdAt,
    final int? favCount,
    final int? commentCount,
    final GalleryViewer? viewer,
    final List<Map<String, dynamic>>? facets,
    final List<String>? cameras,
  }) = _$GalleryImpl;

  factory _Gallery.fromJson(Map<String, dynamic> json) = _$GalleryImpl.fromJson;

  @override
  String get uri;
  @override
  String get cid;
  @override
  String? get title;
  @override
  String? get description;
  @override
  List<GalleryPhoto> get items;
  @override
  Profile? get creator;
  @override
  String? get createdAt;
  @override
  int? get favCount;
  @override
  int? get commentCount;
  @override
  GalleryViewer? get viewer;
  @override
  List<Map<String, dynamic>>? get facets;
  @override
  List<String>? get cameras;

  /// Create a copy of Gallery
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GalleryImplCopyWith<_$GalleryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
