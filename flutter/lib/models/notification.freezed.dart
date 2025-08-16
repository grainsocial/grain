// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notification.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Notification _$NotificationFromJson(Map<String, dynamic> json) {
  return _Notification.fromJson(json);
}

/// @nodoc
mixin _$Notification {
  String get uri => throw _privateConstructorUsedError;
  String get cid => throw _privateConstructorUsedError;
  Profile get author => throw _privateConstructorUsedError;
  Map<String, dynamic> get record => throw _privateConstructorUsedError;
  String get reason => throw _privateConstructorUsedError;
  Gallery? get reasonSubjectGallery => throw _privateConstructorUsedError;
  Profile? get reasonSubjectProfile => throw _privateConstructorUsedError;
  Comment? get reasonSubjectComment => throw _privateConstructorUsedError;
  bool get isRead => throw _privateConstructorUsedError;
  String get indexedAt => throw _privateConstructorUsedError;

  /// Serializes this Notification to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NotificationCopyWith<Notification> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NotificationCopyWith<$Res> {
  factory $NotificationCopyWith(
    Notification value,
    $Res Function(Notification) then,
  ) = _$NotificationCopyWithImpl<$Res, Notification>;
  @useResult
  $Res call({
    String uri,
    String cid,
    Profile author,
    Map<String, dynamic> record,
    String reason,
    Gallery? reasonSubjectGallery,
    Profile? reasonSubjectProfile,
    Comment? reasonSubjectComment,
    bool isRead,
    String indexedAt,
  });

  $ProfileCopyWith<$Res> get author;
  $GalleryCopyWith<$Res>? get reasonSubjectGallery;
  $ProfileCopyWith<$Res>? get reasonSubjectProfile;
  $CommentCopyWith<$Res>? get reasonSubjectComment;
}

/// @nodoc
class _$NotificationCopyWithImpl<$Res, $Val extends Notification>
    implements $NotificationCopyWith<$Res> {
  _$NotificationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? author = null,
    Object? record = null,
    Object? reason = null,
    Object? reasonSubjectGallery = freezed,
    Object? reasonSubjectProfile = freezed,
    Object? reasonSubjectComment = freezed,
    Object? isRead = null,
    Object? indexedAt = null,
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
            author: null == author
                ? _value.author
                : author // ignore: cast_nullable_to_non_nullable
                      as Profile,
            record: null == record
                ? _value.record
                : record // ignore: cast_nullable_to_non_nullable
                      as Map<String, dynamic>,
            reason: null == reason
                ? _value.reason
                : reason // ignore: cast_nullable_to_non_nullable
                      as String,
            reasonSubjectGallery: freezed == reasonSubjectGallery
                ? _value.reasonSubjectGallery
                : reasonSubjectGallery // ignore: cast_nullable_to_non_nullable
                      as Gallery?,
            reasonSubjectProfile: freezed == reasonSubjectProfile
                ? _value.reasonSubjectProfile
                : reasonSubjectProfile // ignore: cast_nullable_to_non_nullable
                      as Profile?,
            reasonSubjectComment: freezed == reasonSubjectComment
                ? _value.reasonSubjectComment
                : reasonSubjectComment // ignore: cast_nullable_to_non_nullable
                      as Comment?,
            isRead: null == isRead
                ? _value.isRead
                : isRead // ignore: cast_nullable_to_non_nullable
                      as bool,
            indexedAt: null == indexedAt
                ? _value.indexedAt
                : indexedAt // ignore: cast_nullable_to_non_nullable
                      as String,
          )
          as $Val,
    );
  }

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileCopyWith<$Res> get author {
    return $ProfileCopyWith<$Res>(_value.author, (value) {
      return _then(_value.copyWith(author: value) as $Val);
    });
  }

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $GalleryCopyWith<$Res>? get reasonSubjectGallery {
    if (_value.reasonSubjectGallery == null) {
      return null;
    }

    return $GalleryCopyWith<$Res>(_value.reasonSubjectGallery!, (value) {
      return _then(_value.copyWith(reasonSubjectGallery: value) as $Val);
    });
  }

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfileCopyWith<$Res>? get reasonSubjectProfile {
    if (_value.reasonSubjectProfile == null) {
      return null;
    }

    return $ProfileCopyWith<$Res>(_value.reasonSubjectProfile!, (value) {
      return _then(_value.copyWith(reasonSubjectProfile: value) as $Val);
    });
  }

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CommentCopyWith<$Res>? get reasonSubjectComment {
    if (_value.reasonSubjectComment == null) {
      return null;
    }

    return $CommentCopyWith<$Res>(_value.reasonSubjectComment!, (value) {
      return _then(_value.copyWith(reasonSubjectComment: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$NotificationImplCopyWith<$Res>
    implements $NotificationCopyWith<$Res> {
  factory _$$NotificationImplCopyWith(
    _$NotificationImpl value,
    $Res Function(_$NotificationImpl) then,
  ) = __$$NotificationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String uri,
    String cid,
    Profile author,
    Map<String, dynamic> record,
    String reason,
    Gallery? reasonSubjectGallery,
    Profile? reasonSubjectProfile,
    Comment? reasonSubjectComment,
    bool isRead,
    String indexedAt,
  });

  @override
  $ProfileCopyWith<$Res> get author;
  @override
  $GalleryCopyWith<$Res>? get reasonSubjectGallery;
  @override
  $ProfileCopyWith<$Res>? get reasonSubjectProfile;
  @override
  $CommentCopyWith<$Res>? get reasonSubjectComment;
}

/// @nodoc
class __$$NotificationImplCopyWithImpl<$Res>
    extends _$NotificationCopyWithImpl<$Res, _$NotificationImpl>
    implements _$$NotificationImplCopyWith<$Res> {
  __$$NotificationImplCopyWithImpl(
    _$NotificationImpl _value,
    $Res Function(_$NotificationImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? uri = null,
    Object? cid = null,
    Object? author = null,
    Object? record = null,
    Object? reason = null,
    Object? reasonSubjectGallery = freezed,
    Object? reasonSubjectProfile = freezed,
    Object? reasonSubjectComment = freezed,
    Object? isRead = null,
    Object? indexedAt = null,
  }) {
    return _then(
      _$NotificationImpl(
        uri: null == uri
            ? _value.uri
            : uri // ignore: cast_nullable_to_non_nullable
                  as String,
        cid: null == cid
            ? _value.cid
            : cid // ignore: cast_nullable_to_non_nullable
                  as String,
        author: null == author
            ? _value.author
            : author // ignore: cast_nullable_to_non_nullable
                  as Profile,
        record: null == record
            ? _value._record
            : record // ignore: cast_nullable_to_non_nullable
                  as Map<String, dynamic>,
        reason: null == reason
            ? _value.reason
            : reason // ignore: cast_nullable_to_non_nullable
                  as String,
        reasonSubjectGallery: freezed == reasonSubjectGallery
            ? _value.reasonSubjectGallery
            : reasonSubjectGallery // ignore: cast_nullable_to_non_nullable
                  as Gallery?,
        reasonSubjectProfile: freezed == reasonSubjectProfile
            ? _value.reasonSubjectProfile
            : reasonSubjectProfile // ignore: cast_nullable_to_non_nullable
                  as Profile?,
        reasonSubjectComment: freezed == reasonSubjectComment
            ? _value.reasonSubjectComment
            : reasonSubjectComment // ignore: cast_nullable_to_non_nullable
                  as Comment?,
        isRead: null == isRead
            ? _value.isRead
            : isRead // ignore: cast_nullable_to_non_nullable
                  as bool,
        indexedAt: null == indexedAt
            ? _value.indexedAt
            : indexedAt // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NotificationImpl implements _Notification {
  const _$NotificationImpl({
    required this.uri,
    required this.cid,
    required this.author,
    required final Map<String, dynamic> record,
    required this.reason,
    this.reasonSubjectGallery,
    this.reasonSubjectProfile,
    this.reasonSubjectComment,
    required this.isRead,
    required this.indexedAt,
  }) : _record = record;

  factory _$NotificationImpl.fromJson(Map<String, dynamic> json) =>
      _$$NotificationImplFromJson(json);

  @override
  final String uri;
  @override
  final String cid;
  @override
  final Profile author;
  final Map<String, dynamic> _record;
  @override
  Map<String, dynamic> get record {
    if (_record is EqualUnmodifiableMapView) return _record;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(_record);
  }

  @override
  final String reason;
  @override
  final Gallery? reasonSubjectGallery;
  @override
  final Profile? reasonSubjectProfile;
  @override
  final Comment? reasonSubjectComment;
  @override
  final bool isRead;
  @override
  final String indexedAt;

  @override
  String toString() {
    return 'Notification(uri: $uri, cid: $cid, author: $author, record: $record, reason: $reason, reasonSubjectGallery: $reasonSubjectGallery, reasonSubjectProfile: $reasonSubjectProfile, reasonSubjectComment: $reasonSubjectComment, isRead: $isRead, indexedAt: $indexedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NotificationImpl &&
            (identical(other.uri, uri) || other.uri == uri) &&
            (identical(other.cid, cid) || other.cid == cid) &&
            (identical(other.author, author) || other.author == author) &&
            const DeepCollectionEquality().equals(other._record, _record) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.reasonSubjectGallery, reasonSubjectGallery) ||
                other.reasonSubjectGallery == reasonSubjectGallery) &&
            (identical(other.reasonSubjectProfile, reasonSubjectProfile) ||
                other.reasonSubjectProfile == reasonSubjectProfile) &&
            (identical(other.reasonSubjectComment, reasonSubjectComment) ||
                other.reasonSubjectComment == reasonSubjectComment) &&
            (identical(other.isRead, isRead) || other.isRead == isRead) &&
            (identical(other.indexedAt, indexedAt) ||
                other.indexedAt == indexedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    uri,
    cid,
    author,
    const DeepCollectionEquality().hash(_record),
    reason,
    reasonSubjectGallery,
    reasonSubjectProfile,
    reasonSubjectComment,
    isRead,
    indexedAt,
  );

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NotificationImplCopyWith<_$NotificationImpl> get copyWith =>
      __$$NotificationImplCopyWithImpl<_$NotificationImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$NotificationImplToJson(this);
  }
}

abstract class _Notification implements Notification {
  const factory _Notification({
    required final String uri,
    required final String cid,
    required final Profile author,
    required final Map<String, dynamic> record,
    required final String reason,
    final Gallery? reasonSubjectGallery,
    final Profile? reasonSubjectProfile,
    final Comment? reasonSubjectComment,
    required final bool isRead,
    required final String indexedAt,
  }) = _$NotificationImpl;

  factory _Notification.fromJson(Map<String, dynamic> json) =
      _$NotificationImpl.fromJson;

  @override
  String get uri;
  @override
  String get cid;
  @override
  Profile get author;
  @override
  Map<String, dynamic> get record;
  @override
  String get reason;
  @override
  Gallery? get reasonSubjectGallery;
  @override
  Profile? get reasonSubjectProfile;
  @override
  Comment? get reasonSubjectComment;
  @override
  bool get isRead;
  @override
  String get indexedAt;

  /// Create a copy of Notification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NotificationImplCopyWith<_$NotificationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
