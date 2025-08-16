// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gallery_cache_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$galleryCacheHash() => r'd604bfc71f008251a36d7943b99294728c31de1f';

/// Holds a cache of galleries by URI.
///
/// Copied from [GalleryCache].
@ProviderFor(GalleryCache)
final galleryCacheProvider =
    NotifierProvider<GalleryCache, Map<String, Gallery>>.internal(
      GalleryCache.new,
      name: r'galleryCacheProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$galleryCacheHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$GalleryCache = Notifier<Map<String, Gallery>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
