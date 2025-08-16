// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gallery_photo.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GalleryPhoto _$GalleryPhotoFromJson(Map<String, dynamic> json) {
  return _GalleryPhoto.fromJson(json);
}

/// @nodoc
mixin _$GalleryPhoto {
  String get uri => throw _privateConstructorUsedError;
  String get cid => throw _privateConstructorUsedError;
  String? get thumb => throw _privateConstructorUsedError;
  String? get fullsize => throw _privateConstructorUsedError;
  String? get alt => throw _privateConstructorUsedError;
  AspectRatio? get aspectRatio => throw _privateConstructorUsedError;
  GalleryState? get gallery => throw _privateConstructorUsedError;
  PhotoExif? get exif => throw _privateConstructorUsedError;

  /// Serializes this GalleryPhoto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GalleryPhotoCopyWith<GalleryPhoto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GalleryPhotoCopyWith<$Res> {
  factory $GalleryPhotoCopyWith(
    GalleryPhoto value,
    $Res Function(GalleryPhoto) then,
  ) = _$GalleryPhotoCopyWithImpl<$Res, GalleryPhoto>;
  @useResult
  $Res call({
    String uri,
    String cid,
    String? thumb,
    String? fullsize,
    String? alt,
    AspectRatio? aspectRatio,
    GalleryState? gallery,
    PhotoExif? exif,
  });

  $AspectRatioCopyWith<$Res>? get aspectRatio;
  $GalleryStateCopyWith<$Res>? get gallery;
  $PhotoExifCopyWith<$Res>? get exif;
}

/// @nodoc
class _$GalleryPhotoCopyWithImpl<$Res, $Val extends GalleryPhoto>
    implements $GalleryPhotoCopyWith<$Res> {
  _$GalleryPhotoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? thumb = freezed,
    Object? fullsize = freezed,
    Object? alt = freezed,
    Object? aspectRatio = freezed,
    Object? gallery = freezed,
    Object? exif = freezed,
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
            thumb: freezed == thumb
                ? _value.thumb
                : thumb // ignore: cast_nullable_to_non_nullable
                      as String?,
            fullsize: freezed == fullsize
                ? _value.fullsize
                : fullsize // ignore: cast_nullable_to_non_nullable
                      as String?,
            alt: freezed == alt
                ? _value.alt
                : alt // ignore: cast_nullable_to_non_nullable
                      as String?,
            aspectRatio: freezed == aspectRatio
                ? _value.aspectRatio
                : aspectRatio // ignore: cast_nullable_to_non_nullable
                      as AspectRatio?,
            gallery: freezed == gallery
                ? _value.gallery
                : gallery // ignore: cast_nullable_to_non_nullable
                      as GalleryState?,
            exif: freezed == exif
                ? _value.exif
                : exif // ignore: cast_nullable_to_non_nullable
                      as PhotoExif?,
          )
          as $Val,
    );
  }

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AspectRatioCopyWith<$Res>? get aspectRatio {
    if (_value.aspectRatio == null) {
      return null;
    }

    return $AspectRatioCopyWith<$Res>(_value.aspectRatio!, (value) {
      return _then(_value.copyWith(aspectRatio: value) as $Val);
    });
  }

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryStateCopyWith<$Res>? get gallery {
    if (_value.gallery == null) {
      return null;
    }

    return $GalleryStateCopyWith<$Res>(_value.gallery!, (value) {
      return _then(_value.copyWith(gallery: value) as $Val);
    });
  }

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PhotoExifCopyWith<$Res>? get exif {
    if (_value.exif == null) {
      return null;
    }

    return $PhotoExifCopyWith<$Res>(_value.exif!, (value) {
      return _then(_value.copyWith(exif: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$GalleryPhotoImplCopyWith<$Res>
    implements $GalleryPhotoCopyWith<$Res> {
  factory _$$GalleryPhotoImplCopyWith(
    _$GalleryPhotoImpl value,
    $Res Function(_$GalleryPhotoImpl) then,
  ) = __$$GalleryPhotoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String uri,
    String cid,
    String? thumb,
    String? fullsize,
    String? alt,
    AspectRatio? aspectRatio,
    GalleryState? gallery,
    PhotoExif? exif,
  });

  @override
  $AspectRatioCopyWith<$Res>? get aspectRatio;
  @override
  $GalleryStateCopyWith<$Res>? get gallery;
  @override
  $PhotoExifCopyWith<$Res>? get exif;
}

/// @nodoc
class __$$GalleryPhotoImplCopyWithImpl<$Res>
    extends _$GalleryPhotoCopyWithImpl<$Res, _$GalleryPhotoImpl>
    implements _$$GalleryPhotoImplCopyWith<$Res> {
  __$$GalleryPhotoImplCopyWithImpl(
    _$GalleryPhotoImpl _value,
    $Res Function(_$GalleryPhotoImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? thumb = freezed,
    Object? fullsize = freezed,
    Object? alt = freezed,
    Object? aspectRatio = freezed,
    Object? gallery = freezed,
    Object? exif = freezed,
  }) {
    return _then(
      _$GalleryPhotoImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
        cid: null == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String,
        thumb: freezed == thumb
            ? _value.thumb
            : thumb // ignore: cast_nullable_to_non_nullable
                  as String?,
        fullsize: freezed == fullsize
            ? _value.fullsize
            : fullsize // ignore: cast_nullable_to_non_nullable
                  as String?,
        alt: freezed == alt
            ? _value.alt
            : alt // ignore: cast_nullable_to_non_nullable
                  as String?,
        aspectRatio: freezed == aspectRatio
            ? _value.aspectRatio
            : aspectRatio // ignore: cast_nullable_to_non_nullable
                  as AspectRatio?,
        gallery: freezed == gallery
            ? _value.gallery
            : gallery // ignore: cast_nullable_to_non_nullable
                  as GalleryState?,
        exif: freezed == exif
            ? _value.exif
            : exif // ignore: cast_nullable_to_non_nullable
                  as PhotoExif?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GalleryPhotoImpl implements _GalleryPhoto {
  const _$GalleryPhotoImpl({
    required this.uri,
    required this.cid,
    this.thumb,
    this.fullsize,
    this.alt,
    this.aspectRatio,
    this.gallery,
    this.exif,
  });

  factory _$GalleryPhotoImpl.fromJson(Map<String, dynamic> json) =>
      _$$GalleryPhotoImplFromJson(json);

  @override
  final String uri;
  @override
  final String cid;
  @override
  final String? thumb;
  @override
  final String? fullsize;
  @override
  final String? alt;
  @override
  final AspectRatio? aspectRatio;
  @override
  final GalleryState? gallery;
  @override
  final PhotoExif? exif;

  @override
  String toString() {
    return 'GalleryPhoto(uri: $uri, cid: $cid, thumb: $thumb, fullsize: $fullsize, alt: $alt, aspectRatio: $aspectRatio, gallery: $gallery, exif: $exif)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GalleryPhotoImpl &&
            (identical(other.uri, uri) || other.uri == uri) &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.thumb, thumb) || other.thumb == thumb) &&
            (identical(other.fullsize, fullsize) ||
                other.fullsize == fullsize) &&
            (identical(other.alt, alt) || other.alt == alt) &&
            (identical(other.aspectRatio, aspectRatio) ||
                other.aspectRatio == aspectRatio) &&
            (identical(other.gallery, gallery) || other.gallery == gallery) &&
            (identical(other.exif, exif) || other.exif == exif));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    uri,
    cid,
    thumb,
    fullsize,
    alt,
    aspectRatio,
    gallery,
    exif,
  );

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GalleryPhotoImplCopyWith<_$GalleryPhotoImpl> get copyWith =>
      __$$GalleryPhotoImplCopyWithImpl<_$GalleryPhotoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GalleryPhotoImplToJson(this);
  }
}

abstract class _GalleryPhoto implements GalleryPhoto {
  const factory _GalleryPhoto({
    required final String uri,
    required final String cid,
    final String? thumb,
    final String? fullsize,
    final String? alt,
    final AspectRatio? aspectRatio,
    final GalleryState? gallery,
    final PhotoExif? exif,
  }) = _$GalleryPhotoImpl;

  factory _GalleryPhoto.fromJson(Map<String, dynamic> json) =
      _$GalleryPhotoImpl.fromJson;

  @override
  String get uri;
  @override
  String get cid;
  @override
  String? get thumb;
  @override
  String? get fullsize;
  @override
  String? get alt;
  @override
  AspectRatio? get aspectRatio;
  @override
  GalleryState? get gallery;
  @override
  PhotoExif? get exif;

  /// Create a copy of GalleryPhoto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GalleryPhotoImplCopyWith<_$GalleryPhotoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
