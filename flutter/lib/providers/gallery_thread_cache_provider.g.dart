// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_thread_cache_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$galleryThreadHash() => r'80fa9b4e19b9d7606654fff8549516d4654dfa87';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

abstract class _$GalleryThread
    extends BuildlessAutoDisposeNotifier<GalleryThreadState> {
  late final String galleryUriParam;

  GalleryThreadState build(String galleryUriParam);
}

/// See also [GalleryThread].
@ProviderFor(GalleryThread)
const galleryThreadProvider = GalleryThreadFamily();

/// See also [GalleryThread].
class GalleryThreadFamily extends Family<GalleryThreadState> {
  /// See also [GalleryThread].
  const GalleryThreadFamily();

  /// See also [GalleryThread].
  GalleryThreadProvider call(String galleryUriParam) {
    return GalleryThreadProvider(galleryUriParam);
  }

  @override
  GalleryThreadProvider getProviderOverride(
    covariant GalleryThreadProvider provider,
  ) {
    return call(provider.galleryUriParam);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'galleryThreadProvider';
}

/// See also [GalleryThread].
class GalleryThreadProvider
    extends AutoDisposeNotifierProviderImpl<GalleryThread, GalleryThreadState> {
  /// See also [GalleryThread].
  GalleryThreadProvider(String galleryUriParam)
    : this._internal(
        () => GalleryThread()..galleryUriParam = galleryUriParam,
        from: galleryThreadProvider,
        name: r'galleryThreadProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$galleryThreadHash,
        dependencies: GalleryThreadFamily._dependencies,
        allTransitiveDependencies:
            GalleryThreadFamily._allTransitiveDependencies,
        galleryUriParam: galleryUriParam,
      );

  GalleryThreadProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.galleryUriParam,
  }) : super.internal();

  final String galleryUriParam;

  @override
  GalleryThreadState runNotifierBuild(covariant GalleryThread notifier) {
    return notifier.build(galleryUriParam);
  }

  @override
  Override overrideWith(GalleryThread Function() create) {
    return ProviderOverride(
      origin: this,
      override: GalleryThreadProvider._internal(
        () => create()..galleryUriParam = galleryUriParam,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        galleryUriParam: galleryUriParam,
      ),
    );
  }

  @override
  AutoDisposeNotifierProviderElement<GalleryThread, GalleryThreadState>
  createElement() {
    return _GalleryThreadProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is GalleryThreadProvider &&
        other.galleryUriParam == galleryUriParam;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, galleryUriParam.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin GalleryThreadRef on AutoDisposeNotifierProviderRef<GalleryThreadState> {
  /// The parameter `galleryUriParam` of this provider.
  String get galleryUriParam;
}

class _GalleryThreadProviderElement
    extends
        AutoDisposeNotifierProviderElement<GalleryThread, GalleryThreadState>
    with GalleryThreadRef {
  _GalleryThreadProviderElement(super.provider);

  @override
  String get galleryUriParam =>
      (origin as GalleryThreadProvider).galleryUriParam;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
