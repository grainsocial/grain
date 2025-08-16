// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'gallery_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

GalleryState _$GalleryStateFromJson(Map<String, dynamic> json) {
  return _GalleryState.fromJson(json);
}

/// @nodoc
mixin _$GalleryState {
  String get item => throw _privateConstructorUsedError;
  String get itemCreatedAt => throw _privateConstructorUsedError;
  int? get itemPosition => throw _privateConstructorUsedError;

  /// Serializes this GalleryState to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GalleryState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GalleryStateCopyWith<GalleryState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GalleryStateCopyWith<$Res> {
  factory $GalleryStateCopyWith(
    GalleryState value,
    $Res Function(GalleryState) then,
  ) = _$GalleryStateCopyWithImpl<$Res, GalleryState>;
  @useResult
  $Res call({String item, String itemCreatedAt, int? itemPosition});
}

/// @nodoc
class _$GalleryStateCopyWithImpl<$Res, $Val extends GalleryState>
    implements $GalleryStateCopyWith<$Res> {
  _$GalleryStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GalleryState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? item = null,
    Object? itemCreatedAt = null,
    Object? itemPosition = freezed,
  }) {
    return _then(
      _value.copyWith(
            item: null == item
                ? _value.item
                : item // ignore: cast_nullable_to_non_nullable
                      as String,
            itemCreatedAt: null == itemCreatedAt
                ? _value.itemCreatedAt
                : itemCreatedAt // ignore: cast_nullable_to_non_nullable
                      as String,
            itemPosition: freezed == itemPosition
                ? _value.itemPosition
                : itemPosition // ignore: cast_nullable_to_non_nullable
                      as int?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$GalleryStateImplCopyWith<$Res>
    implements $GalleryStateCopyWith<$Res> {
  factory _$$GalleryStateImplCopyWith(
    _$GalleryStateImpl value,
    $Res Function(_$GalleryStateImpl) then,
  ) = __$$GalleryStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String item, String itemCreatedAt, int? itemPosition});
}

/// @nodoc
class __$$GalleryStateImplCopyWithImpl<$Res>
    extends _$GalleryStateCopyWithImpl<$Res, _$GalleryStateImpl>
    implements _$$GalleryStateImplCopyWith<$Res> {
  __$$GalleryStateImplCopyWithImpl(
    _$GalleryStateImpl _value,
    $Res Function(_$GalleryStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of GalleryState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? item = null,
    Object? itemCreatedAt = null,
    Object? itemPosition = freezed,
  }) {
    return _then(
      _$GalleryStateImpl(
        item: null == item
            ? _value.item
            : item // ignore: cast_nullable_to_non_nullable
                  as String,
        itemCreatedAt: null == itemCreatedAt
            ? _value.itemCreatedAt
            : itemCreatedAt // ignore: cast_nullable_to_non_nullable
                  as String,
        itemPosition: freezed == itemPosition
            ? _value.itemPosition
            : itemPosition // ignore: cast_nullable_to_non_nullable
                  as int?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$GalleryStateImpl implements _GalleryState {
  const _$GalleryStateImpl({
    required this.item,
    required this.itemCreatedAt,
    this.itemPosition,
  });

  factory _$GalleryStateImpl.fromJson(Map<String, dynamic> json) =>
      _$$GalleryStateImplFromJson(json);

  @override
  final String item;
  @override
  final String itemCreatedAt;
  @override
  final int? itemPosition;

  @override
  String toString() {
    return 'GalleryState(item: $item, itemCreatedAt: $itemCreatedAt, itemPosition: $itemPosition)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GalleryStateImpl &&
            (identical(other.item, item) || other.item == item) &&
            (identical(other.itemCreatedAt, itemCreatedAt) ||
                other.itemCreatedAt == itemCreatedAt) &&
            (identical(other.itemPosition, itemPosition) ||
                other.itemPosition == itemPosition));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, item, itemCreatedAt, itemPosition);

  /// Create a copy of GalleryState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GalleryStateImplCopyWith<_$GalleryStateImpl> get copyWith =>
      __$$GalleryStateImplCopyWithImpl<_$GalleryStateImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GalleryStateImplToJson(this);
  }
}

abstract class _GalleryState implements GalleryState {
  const factory _GalleryState({
    required final String item,
    required final String itemCreatedAt,
    final int? itemPosition,
  }) = _$GalleryStateImpl;

  factory _GalleryState.fromJson(Map<String, dynamic> json) =
      _$GalleryStateImpl.fromJson;

  @override
  String get item;
  @override
  String get itemCreatedAt;
  @override
  int? get itemPosition;

  /// Create a copy of GalleryState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GalleryStateImplCopyWith<_$GalleryStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
