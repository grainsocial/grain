// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_comment_response.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CreateCommentResponse _$CreateCommentResponseFromJson(
  Map<String, dynamic> json,
) {
  return _CreateCommentResponse.fromJson(json);
}

/// @nodoc
mixin _$CreateCommentResponse {
  String get commentUri => throw _privateConstructorUsedError;

  /// Serializes this CreateCommentResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateCommentResponseCopyWith<CreateCommentResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateCommentResponseCopyWith<$Res> {
  factory $CreateCommentResponseCopyWith(
    CreateCommentResponse value,
    $Res Function(CreateCommentResponse) then,
  ) = _$CreateCommentResponseCopyWithImpl<$Res, CreateCommentResponse>;
  @useResult
  $Res call({String commentUri});
}

/// @nodoc
class _$CreateCommentResponseCopyWithImpl<
  $Res,
  $Val extends CreateCommentResponse
>
    implements $CreateCommentResponseCopyWith<$Res> {
  _$CreateCommentResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? commentUri = null}) {
    return _then(
      _value.copyWith(
            commentUri: null == commentUri
                ? _value.commentUri
                : commentUri // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CreateCommentResponseImplCopyWith<$Res>
    implements $CreateCommentResponseCopyWith<$Res> {
  factory _$$CreateCommentResponseImplCopyWith(
    _$CreateCommentResponseImpl value,
    $Res Function(_$CreateCommentResponseImpl) then,
  ) = __$$CreateCommentResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String commentUri});
}

/// @nodoc
class __$$CreateCommentResponseImplCopyWithImpl<$Res>
    extends
        _$CreateCommentResponseCopyWithImpl<$Res, _$CreateCommentResponseImpl>
    implements _$$CreateCommentResponseImplCopyWith<$Res> {
  __$$CreateCommentResponseImplCopyWithImpl(
    _$CreateCommentResponseImpl _value,
    $Res Function(_$CreateCommentResponseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CreateCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? commentUri = null}) {
    return _then(
      _$CreateCommentResponseImpl(
        commentUri: null == commentUri
            ? _value.commentUri
            : commentUri // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateCommentResponseImpl implements _CreateCommentResponse {
  const _$CreateCommentResponseImpl({required this.commentUri});

  factory _$CreateCommentResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateCommentResponseImplFromJson(json);

  @override
  final String commentUri;

  @override
  String toString() {
    return 'CreateCommentResponse(commentUri: $commentUri)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateCommentResponseImpl &&
            (identical(other.commentUri, commentUri) ||
                other.commentUri == commentUri));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, commentUri);

  /// Create a copy of CreateCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateCommentResponseImplCopyWith<_$CreateCommentResponseImpl>
  get copyWith =>
      __$$CreateCommentResponseImplCopyWithImpl<_$CreateCommentResponseImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateCommentResponseImplToJson(this);
  }
}

abstract class _CreateCommentResponse implements CreateCommentResponse {
  const factory _CreateCommentResponse({required final String commentUri}) =
      _$CreateCommentResponseImpl;

  factory _CreateCommentResponse.fromJson(Map<String, dynamic> json) =
      _$CreateCommentResponseImpl.fromJson;

  @override
  String get commentUri;

  /// Create a copy of CreateCommentResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateCommentResponseImplCopyWith<_$CreateCommentResponseImpl>
  get copyWith => throw _privateConstructorUsedError;
}
