// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'photo_exif.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

PhotoExif _$PhotoExifFromJson(Map<String, dynamic> json) {
  return _PhotoExif.fromJson(json);
}

/// @nodoc
mixin _$PhotoExif {
  String get photo => throw _privateConstructorUsedError; // at-uri
  String get createdAt => throw _privateConstructorUsedError; // datetime
  String? get uri => throw _privateConstructorUsedError; // at-uri
  String? get cid => throw _privateConstructorUsedError; // cid
  String? get dateTimeOriginal =>
      throw _privateConstructorUsedError; // datetime
  String? get exposureTime => throw _privateConstructorUsedError;
  String? get fNumber => throw _privateConstructorUsedError;
  String? get flash => throw _privateConstructorUsedError;
  String? get focalLengthIn35mmFormat => throw _privateConstructorUsedError;
  int? get iSO => throw _privateConstructorUsedError;
  String? get lensMake => throw _privateConstructorUsedError;
  String? get lensModel => throw _privateConstructorUsedError;
  String? get make => throw _privateConstructorUsedError;
  String? get model => throw _privateConstructorUsedError;
  Map<String, dynamic>? get record => throw _privateConstructorUsedError;

  /// Serializes this PhotoExif to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PhotoExif
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PhotoExifCopyWith<PhotoExif> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PhotoExifCopyWith<$Res> {
  factory $PhotoExifCopyWith(PhotoExif value, $Res Function(PhotoExif) then) =
      _$PhotoExifCopyWithImpl<$Res, PhotoExif>;
  @useResult
  $Res call({
    String photo,
    String createdAt,
    String? uri,
    String? cid,
    String? dateTimeOriginal,
    String? exposureTime,
    String? fNumber,
    String? flash,
    String? focalLengthIn35mmFormat,
    int? iSO,
    String? lensMake,
    String? lensModel,
    String? make,
    String? model,
    Map<String, dynamic>? record,
  });
}

/// @nodoc
class _$PhotoExifCopyWithImpl<$Res, $Val extends PhotoExif>
    implements $PhotoExifCopyWith<$Res> {
  _$PhotoExifCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PhotoExif
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? photo = null,
    Object? createdAt = null,
    Object? uri = freezed,
    Object? cid = freezed,
    Object? dateTimeOriginal = freezed,
    Object? exposureTime = freezed,
    Object? fNumber = freezed,
    Object? flash = freezed,
    Object? focalLengthIn35mmFormat = freezed,
    Object? iSO = freezed,
    Object? lensMake = freezed,
    Object? lensModel = freezed,
    Object? make = freezed,
    Object? model = freezed,
    Object? record = freezed,
  }) {
    return _then(
      _value.copyWith(
            photo: null == photo
                ? _value.photo
                : photo // ignore: cast_nullable_to_non_nullable
                      as String,
            createdAt: null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                      as String,
            uri: freezed == uri
                ? _value.uri
                : uri // ignore: cast_nullable_to_non_nullable
                      as String?,
            cid: freezed == cid
                ? _value.cid
                : cid // ignore: cast_nullable_to_non_nullable
                      as String?,
            dateTimeOriginal: freezed == dateTimeOriginal
                ? _value.dateTimeOriginal
                : dateTimeOriginal // ignore: cast_nullable_to_non_nullable
                      as String?,
            exposureTime: freezed == exposureTime
                ? _value.exposureTime
                : exposureTime // ignore: cast_nullable_to_non_nullable
                      as String?,
            fNumber: freezed == fNumber
                ? _value.fNumber
                : fNumber // ignore: cast_nullable_to_non_nullable
                      as String?,
            flash: freezed == flash
                ? _value.flash
                : flash // ignore: cast_nullable_to_non_nullable
                      as String?,
            focalLengthIn35mmFormat: freezed == focalLengthIn35mmFormat
                ? _value.focalLengthIn35mmFormat
                : focalLengthIn35mmFormat // ignore: cast_nullable_to_non_nullable
                      as String?,
            iSO: freezed == iSO
                ? _value.iSO
                : iSO // ignore: cast_nullable_to_non_nullable
                      as int?,
            lensMake: freezed == lensMake
                ? _value.lensMake
                : lensMake // ignore: cast_nullable_to_non_nullable
                      as String?,
            lensModel: freezed == lensModel
                ? _value.lensModel
                : lensModel // ignore: cast_nullable_to_non_nullable
                      as String?,
            make: freezed == make
                ? _value.make
                : make // ignore: cast_nullable_to_non_nullable
                      as String?,
            model: freezed == model
                ? _value.model
                : model // ignore: cast_nullable_to_non_nullable
                      as String?,
            record: freezed == record
                ? _value.record
                : record // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$PhotoExifImplCopyWith<$Res>
    implements $PhotoExifCopyWith<$Res> {
  factory _$$PhotoExifImplCopyWith(
    _$PhotoExifImpl value,
    $Res Function(_$PhotoExifImpl) then,
  ) = __$$PhotoExifImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String photo,
    String createdAt,
    String? uri,
    String? cid,
    String? dateTimeOriginal,
    String? exposureTime,
    String? fNumber,
    String? flash,
    String? focalLengthIn35mmFormat,
    int? iSO,
    String? lensMake,
    String? lensModel,
    String? make,
    String? model,
    Map<String, dynamic>? record,
  });
}

/// @nodoc
class __$$PhotoExifImplCopyWithImpl<$Res>
    extends _$PhotoExifCopyWithImpl<$Res, _$PhotoExifImpl>
    implements _$$PhotoExifImplCopyWith<$Res> {
  __$$PhotoExifImplCopyWithImpl(
    _$PhotoExifImpl _value,
    $Res Function(_$PhotoExifImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of PhotoExif
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? photo = null,
    Object? createdAt = null,
    Object? uri = freezed,
    Object? cid = freezed,
    Object? dateTimeOriginal = freezed,
    Object? exposureTime = freezed,
    Object? fNumber = freezed,
    Object? flash = freezed,
    Object? focalLengthIn35mmFormat = freezed,
    Object? iSO = freezed,
    Object? lensMake = freezed,
    Object? lensModel = freezed,
    Object? make = freezed,
    Object? model = freezed,
    Object? record = freezed,
  }) {
    return _then(
      _$PhotoExifImpl(
        photo: null == photo
            ? _value.photo
            : photo // ignore: cast_nullable_to_non_nullable
                  as String,
        createdAt: null == createdAt
            ? _value.createdAt
            : createdAt // ignore: cast_nullable_to_non_nullable
                  as String,
        uri: freezed == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String?,
        cid: freezed == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String?,
        dateTimeOriginal: freezed == dateTimeOriginal
            ? _value.dateTimeOriginal
            : dateTimeOriginal // ignore: cast_nullable_to_non_nullable
                  as String?,
        exposureTime: freezed == exposureTime
            ? _value.exposureTime
            : exposureTime // ignore: cast_nullable_to_non_nullable
                  as String?,
        fNumber: freezed == fNumber
            ? _value.fNumber
            : fNumber // ignore: cast_nullable_to_non_nullable
                  as String?,
        flash: freezed == flash
            ? _value.flash
            : flash // ignore: cast_nullable_to_non_nullable
                  as String?,
        focalLengthIn35mmFormat: freezed == focalLengthIn35mmFormat
            ? _value.focalLengthIn35mmFormat
            : focalLengthIn35mmFormat // ignore: cast_nullable_to_non_nullable
                  as String?,
        iSO: freezed == iSO
            ? _value.iSO
            : iSO // ignore: cast_nullable_to_non_nullable
                  as int?,
        lensMake: freezed == lensMake
            ? _value.lensMake
            : lensMake // ignore: cast_nullable_to_non_nullable
                  as String?,
        lensModel: freezed == lensModel
            ? _value.lensModel
            : lensModel // ignore: cast_nullable_to_non_nullable
                  as String?,
        make: freezed == make
            ? _value.make
            : make // ignore: cast_nullable_to_non_nullable
                  as String?,
        model: freezed == model
            ? _value.model
            : model // ignore: cast_nullable_to_non_nullable
                  as String?,
        record: freezed == record
            ? _value._record
            : record // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$PhotoExifImpl implements _PhotoExif {
  const _$PhotoExifImpl({
    required this.photo,
    required this.createdAt,
    this.uri,
    this.cid,
    this.dateTimeOriginal,
    this.exposureTime,
    this.fNumber,
    this.flash,
    this.focalLengthIn35mmFormat,
    this.iSO,
    this.lensMake,
    this.lensModel,
    this.make,
    this.model,
    final Map<String, dynamic>? record,
  }) : _record = record;

  factory _$PhotoExifImpl.fromJson(Map<String, dynamic> json) =>
      _$$PhotoExifImplFromJson(json);

  @override
  final String photo;
  // at-uri
  @override
  final String createdAt;
  // datetime
  @override
  final String? uri;
  // at-uri
  @override
  final String? cid;
  // cid
  @override
  final String? dateTimeOriginal;
  // datetime
  @override
  final String? exposureTime;
  @override
  final String? fNumber;
  @override
  final String? flash;
  @override
  final String? focalLengthIn35mmFormat;
  @override
  final int? iSO;
  @override
  final String? lensMake;
  @override
  final String? lensModel;
  @override
  final String? make;
  @override
  final String? model;
  final Map<String, dynamic>? _record;
  @override
  Map<String, dynamic>? get record {
    final value = _record;
    if (value == null) return null;
    if (_record is EqualUnmodifiableMapView) return _record;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  String toString() {
    return 'PhotoExif(photo: $photo, createdAt: $createdAt, uri: $uri, cid: $cid, dateTimeOriginal: $dateTimeOriginal, exposureTime: $exposureTime, fNumber: $fNumber, flash: $flash, focalLengthIn35mmFormat: $focalLengthIn35mmFormat, iSO: $iSO, lensMake: $lensMake, lensModel: $lensModel, make: $make, model: $model, record: $record)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PhotoExifImpl &&
            (identical(other.photo, photo) || other.photo == photo) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.uri, uri) || other.uri == uri) &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.dateTimeOriginal, dateTimeOriginal) ||
                other.dateTimeOriginal == dateTimeOriginal) &&
            (identical(other.exposureTime, exposureTime) ||
                other.exposureTime == exposureTime) &&
            (identical(other.fNumber, fNumber) || other.fNumber == fNumber) &&
            (identical(other.flash, flash) || other.flash == flash) &&
            (identical(
                  other.focalLengthIn35mmFormat,
                  focalLengthIn35mmFormat,
                ) ||
                other.focalLengthIn35mmFormat == focalLengthIn35mmFormat) &&
            (identical(other.iSO, iSO) || other.iSO == iSO) &&
            (identical(other.lensMake, lensMake) ||
                other.lensMake == lensMake) &&
            (identical(other.lensModel, lensModel) ||
                other.lensModel == lensModel) &&
            (identical(other.make, make) || other.make == make) &&
            (identical(other.model, model) || other.model == model) &&
            const DeepCollectionEquality().equals(other._record, _record));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    photo,
    createdAt,
    uri,
    cid,
    dateTimeOriginal,
    exposureTime,
    fNumber,
    flash,
    focalLengthIn35mmFormat,
    iSO,
    lensMake,
    lensModel,
    make,
    model,
    const DeepCollectionEquality().hash(_record),
  );

  /// Create a copy of PhotoExif
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PhotoExifImplCopyWith<_$PhotoExifImpl> get copyWith =>
      __$$PhotoExifImplCopyWithImpl<_$PhotoExifImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PhotoExifImplToJson(this);
  }
}

abstract class _PhotoExif implements PhotoExif {
  const factory _PhotoExif({
    required final String photo,
    required final String createdAt,
    final String? uri,
    final String? cid,
    final String? dateTimeOriginal,
    final String? exposureTime,
    final String? fNumber,
    final String? flash,
    final String? focalLengthIn35mmFormat,
    final int? iSO,
    final String? lensMake,
    final String? lensModel,
    final String? make,
    final String? model,
    final Map<String, dynamic>? record,
  }) = _$PhotoExifImpl;

  factory _PhotoExif.fromJson(Map<String, dynamic> json) =
      _$PhotoExifImpl.fromJson;

  @override
  String get photo; // at-uri
  @override
  String get createdAt; // datetime
  @override
  String? get uri; // at-uri
  @override
  String? get cid; // cid
  @override
  String? get dateTimeOriginal; // datetime
  @override
  String? get exposureTime;
  @override
  String? get fNumber;
  @override
  String? get flash;
  @override
  String? get focalLengthIn35mmFormat;
  @override
  int? get iSO;
  @override
  String? get lensMake;
  @override
  String? get lensModel;
  @override
  String? get make;
  @override
  String? get model;
  @override
  Map<String, dynamic>? get record;

  /// Create a copy of PhotoExif
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PhotoExifImplCopyWith<_$PhotoExifImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
