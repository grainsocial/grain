// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'apply_alts_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

ApplyAltsRequest _$ApplyAltsRequestFromJson(Map<String, dynamic> json) {
  return _ApplyAltsRequest.fromJson(json);
}

/// @nodoc
mixin _$ApplyAltsRequest {
  List<ApplyAltsUpdate> get writes => throw _privateConstructorUsedError;

  /// Serializes this ApplyAltsRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ApplyAltsRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ApplyAltsRequestCopyWith<ApplyAltsRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ApplyAltsRequestCopyWith<$Res> {
  factory $ApplyAltsRequestCopyWith(
    ApplyAltsRequest value,
    $Res Function(ApplyAltsRequest) then,
  ) = _$ApplyAltsRequestCopyWithImpl<$Res, ApplyAltsRequest>;
  @useResult
  $Res call({List<ApplyAltsUpdate> writes});
}

/// @nodoc
class _$ApplyAltsRequestCopyWithImpl<$Res, $Val extends ApplyAltsRequest>
    implements $ApplyAltsRequestCopyWith<$Res> {
  _$ApplyAltsRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ApplyAltsRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? writes = null}) {
    return _then(
      _value.copyWith(
            writes: null == writes
                ? _value.writes
                : writes // ignore: cast_nullable_to_non_nullable
                      as List<ApplyAltsUpdate>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ApplyAltsRequestImplCopyWith<$Res>
    implements $ApplyAltsRequestCopyWith<$Res> {
  factory _$$ApplyAltsRequestImplCopyWith(
    _$ApplyAltsRequestImpl value,
    $Res Function(_$ApplyAltsRequestImpl) then,
  ) = __$$ApplyAltsRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<ApplyAltsUpdate> writes});
}

/// @nodoc
class __$$ApplyAltsRequestImplCopyWithImpl<$Res>
    extends _$ApplyAltsRequestCopyWithImpl<$Res, _$ApplyAltsRequestImpl>
    implements _$$ApplyAltsRequestImplCopyWith<$Res> {
  __$$ApplyAltsRequestImplCopyWithImpl(
    _$ApplyAltsRequestImpl _value,
    $Res Function(_$ApplyAltsRequestImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ApplyAltsRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? writes = null}) {
    return _then(
      _$ApplyAltsRequestImpl(
        writes: null == writes
            ? _value._writes
            : writes // ignore: cast_nullable_to_non_nullable
                  as List<ApplyAltsUpdate>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ApplyAltsRequestImpl implements _ApplyAltsRequest {
  const _$ApplyAltsRequestImpl({required final List<ApplyAltsUpdate> writes})
    : _writes = writes;

  factory _$ApplyAltsRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$ApplyAltsRequestImplFromJson(json);

  final List<ApplyAltsUpdate> _writes;
  @override
  List<ApplyAltsUpdate> get writes {
    if (_writes is EqualUnmodifiableListView) return _writes;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_writes);
  }

  @override
  String toString() {
    return 'ApplyAltsRequest(writes: $writes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ApplyAltsRequestImpl &&
            const DeepCollectionEquality().equals(other._writes, _writes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, const DeepCollectionEquality().hash(_writes));

  /// Create a copy of ApplyAltsRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ApplyAltsRequestImplCopyWith<_$ApplyAltsRequestImpl> get copyWith =>
      __$$ApplyAltsRequestImplCopyWithImpl<_$ApplyAltsRequestImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$ApplyAltsRequestImplToJson(this);
  }
}

abstract class _ApplyAltsRequest implements ApplyAltsRequest {
  const factory _ApplyAltsRequest({
    required final List<ApplyAltsUpdate> writes,
  }) = _$ApplyAltsRequestImpl;

  factory _ApplyAltsRequest.fromJson(Map<String, dynamic> json) =
      _$ApplyAltsRequestImpl.fromJson;

  @override
  List<ApplyAltsUpdate> get writes;

  /// Create a copy of ApplyAltsRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ApplyAltsRequestImplCopyWith<_$ApplyAltsRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
