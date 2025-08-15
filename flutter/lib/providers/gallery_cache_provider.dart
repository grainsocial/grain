import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/models/procedures/apply_alts_update.dart';
import 'package:grain/models/procedures/procedures.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../api.dart';
import '../app_logger.dart';
import '../models/gallery.dart';
import '../models/gallery_item.dart';
import '../photo_manip.dart';
import '../utils/exif_utils.dart';

part 'gallery_cache_provider.g.dart';

/// Holds a cache of galleries by URI.
@Riverpod(keepAlive: true)
class GalleryCache extends _$GalleryCache {
  @override
  Map<String, Gallery> build() => {};

  void setGalleries(List<Gallery> galleries) {
    final newMap = {for (final g in galleries) g.uri: g};
    state = {...state, ...newMap};
  }

  void setGallery(Gallery gallery) {
    state = {...state, gallery.uri: gallery};
  }

  void removeGallery(String uri) {
    final newState = {...state}..remove(uri);
    state = newState;
  }

  Gallery? getGallery(String uri) => state[uri];

  void setGalleriesForActor(String did, List<Gallery> galleries) {
    setGalleries(galleries);
  }

  Future<void> toggleFavorite(String uri) async {
    // Fetch the latest gallery from the API to ensure up-to-date favorite state
    final latestGallery = await apiService.getGallery(uri: uri);
    if (latestGallery == null) return;
    final isCurrentlyFav = latestGallery.viewer?.fav != null;
    final isFav = !isCurrentlyFav;
    bool success = false;
    String? newFavUri;
    if (isFav) {
      final response = await apiService.createFavorite(
        request: CreateFavoriteRequest(subject: latestGallery.uri),
      );
      newFavUri = response.favoriteUri;
      success = true;
    } else {
      final deleteResponse = await apiService.deleteFavorite(
        request: DeleteFavoriteRequest(uri: latestGallery.viewer?.fav ?? uri),
      );
      success = deleteResponse.success;
      newFavUri = null;
    }
    if (success) {
      final newCount = (latestGallery.favCount ?? 0) + (isFav ? 1 : -1);
      final updatedViewer = latestGallery.viewer?.copyWith(fav: newFavUri);
      final updatedGallery = latestGallery.copyWith(favCount: newCount, viewer: updatedViewer);
      state = {...state, uri: updatedGallery};

      // Push favorite change to profile provider favs
      final profileProvider = ref.read(
        profileNotifierProvider(apiService.currentUser!.did).notifier,
      );
      if (isFav) {
        profileProvider.addFavorite(updatedGallery);
      } else {
        profileProvider.removeFavorite(updatedGallery.uri);
      }
    }
  }

  /// Removes a photo from a gallery in the cache by galleryItemUri and deletes it from the backend.
  Future<void> removePhotoFromGallery(String galleryUri, String galleryItemUri) async {
    final gallery = state[galleryUri];
    if (gallery == null) return;
    // Call backend to delete the gallery item
    await apiService.deleteGalleryItem(request: DeleteGalleryItemRequest(uri: galleryItemUri));
    // Remove by gallery item record URI, not photo URI
    final updatedItems = gallery.items.where((p) => p.gallery?.item != galleryItemUri).toList();
    final updatedGallery = gallery.copyWith(items: updatedItems);
    state = {...state, galleryUri: updatedGallery};
  }

  Future<List<String>> uploadAndAddPhotosToGallery({
    required String galleryUri,
    required List<XFile> xfiles,
    int? startPosition,
    bool includeExif = true,
    void Function(int imageIndex, double progress)? onProgress,
  }) async {
    // Fetch the latest gallery from the API to avoid stale state
    final latestGallery = await apiService.getGallery(uri: galleryUri);
    if (latestGallery != null) {
      state = {...state, galleryUri: latestGallery};
    }
    final gallery = latestGallery ?? state[galleryUri];
    final int initialCount = gallery?.items.length ?? 0;
    final int positionOffset = startPosition ?? initialCount;
    final List<String> photoUris = [];
    int position = positionOffset;
    for (int i = 0; i < xfiles.length; i++) {
      final xfile = xfiles[i];
      // Report progress if callback is provided
      onProgress?.call(i, 0.0);

      final file = File(xfile.path);
      // Parse EXIF if requested
      final exif = includeExif ? await parseAndNormalizeExif(file: file) : null;

      // Simulate progress steps
      for (int p = 1; p <= 10; p++) {
        await Future.delayed(const Duration(milliseconds: 30));
        onProgress?.call(i, p / 10.0);
      }

      // Resize the image
      final resizedResult = await compute<File, ResizeResult>((f) => resizeImage(file: f), file);
      // Upload the blob
      final res = await apiService.uploadPhoto(resizedResult.file);
      if (res.photoUri.isEmpty) continue;
      // If EXIF data was found, create photo exif record
      if (exif != null) {
        await apiService.createExif(
          request: CreateExifRequest(
            photo: res.photoUri,
            dateTimeOriginal: exif['dateTimeOriginal'],
            exposureTime: exif['exposureTime'],
            fNumber: exif['fNumber'],
            flash: exif['flash'],
            focalLengthIn35mmFormat: exif['focalLengthIn35mmFilm'],
            iSO: exif['iSOSpeedRatings'],
            lensMake: exif['lensMake'],
            lensModel: exif['lensModel'],
            make: exif['make'],
            model: exif['model'],
          ),
        );
      }

      // Create the gallery item
      await apiService.createGalleryItem(
        request: CreateGalleryItemRequest(
          galleryUri: galleryUri,
          photoUri: res.photoUri,
          position: position,
        ),
      );
      photoUris.add(res.photoUri);
      position++;
    }
    // Fetch the updated gallery and update the cache
    final updatedGallery = await apiService.getGallery(uri: galleryUri);
    if (updatedGallery != null) {
      state = {...state, galleryUri: updatedGallery};
    }
    return photoUris;
  }

  /// Creates a new gallery, uploads photos, and adds them as gallery items.
  /// Returns the new gallery URI and the list of new photoUris if successful, or null/empty list otherwise.
  Future<(String?, List<String>)> createGalleryAndAddPhotos({
    required String title,
    required String description,
    required List<XFile> xfiles,
    bool includeExif = true,
    void Function(int imageIndex, double progress)? onProgress,
  }) async {
    final res = await apiService.createGallery(
      request: CreateGalleryRequest(title: title, description: description),
    );
    // Upload and add photos
    final photoUris = await uploadAndAddPhotosToGallery(
      galleryUri: res.galleryUri,
      xfiles: xfiles,
      includeExif: includeExif,
      onProgress: onProgress,
    );
    return (res.galleryUri, photoUris);
  }

  /// Creates gallery items for existing photoUris and updates the cache.
  /// Returns the list of new gallery item URIs if successful, or empty list otherwise.
  Future<List<String>> addGalleryItemsToGallery({
    required String galleryUri,
    required List<String> photoUris,
    int? startPosition,
  }) async {
    // Fetch the latest gallery from the API to avoid stale state
    final latestGallery = await apiService.getGallery(uri: galleryUri);
    if (latestGallery != null) {
      state = {...state, galleryUri: latestGallery};
    }
    final gallery = latestGallery ?? state[galleryUri];
    final int initialCount = gallery?.items.length ?? 0;
    final int positionOffset = startPosition ?? initialCount;
    final List<String> galleryItemUris = [];
    int position = positionOffset;
    for (final photoUri in photoUris) {
      // Create the gallery item
      final res = await apiService.createGalleryItem(
        request: CreateGalleryItemRequest(
          galleryUri: galleryUri,
          photoUri: photoUri,
          position: position,
        ),
      );
      if (res.itemUri.isNotEmpty) {
        galleryItemUris.add(res.itemUri);
        position++;
      }
    }
    // Fetch the updated gallery and update the cache
    final updatedGallery = await apiService.getGallery(uri: galleryUri);
    if (updatedGallery != null) {
      state = {...state, galleryUri: updatedGallery};
    }
    return galleryItemUris;
  }

  /// Deletes a gallery from the backend and removes it from the cache.
  Future<void> deleteGallery(String uri) async {
    await apiService.deleteGallery(request: DeleteGalleryRequest(uri: uri));
    removeGallery(uri);
  }

  /// Reorders gallery items and updates backend, then updates cache.
  Future<void> reorderGalleryItems({
    required String galleryUri,
    required List<GalleryPhoto> newOrder,
  }) async {
    final gallery = state[galleryUri];
    if (gallery == null) return;
    final orderedItems = newOrder.map((photo) {
      // Map GalleryPhoto to GalleryItem
      return GalleryItem(
        uri: photo.gallery?.item ?? '',
        gallery: galleryUri,
        item: photo.uri,
        createdAt: photo.gallery?.itemCreatedAt ?? '',
        position: photo.gallery?.itemPosition ?? 0,
      );
    }).toList();
    // Optionally update positions if needed
    for (int i = 0; i < orderedItems.length; i++) {
      orderedItems[i] = orderedItems[i].copyWith(position: i);
    }
    final res = await apiService.applySort(
      request: ApplySortRequest(
        writes: orderedItems
            .map((item) => ApplySortUpdate(itemUri: item.uri, position: item.position))
            .toList(),
      ),
    );
    if (!res.success) {
      appLogger.w('Failed to reorder gallery items for $galleryUri');
      return;
    }
    // Update cache with new order
    final updatedPhotos = orderedItems
        .where((item) => gallery.items.any((p) => p.uri == item.item))
        .map((item) {
          final photo = gallery.items.firstWhere((p) => p.uri == item.item);
          return photo.copyWith(gallery: photo.gallery?.copyWith(itemPosition: item.position));
        })
        .toList();
    final updatedGallery = gallery.copyWith(items: updatedPhotos);
    state = {...state, galleryUri: updatedGallery};
  }

  /// Updates gallery details (title, description) and updates cache.
  Future<bool> updateGalleryDetails({
    required String galleryUri,
    required String title,
    required String description,
    required String createdAt,
  }) async {
    try {
      await apiService.updateGallery(
        request: UpdateGalleryRequest(
          galleryUri: galleryUri,
          title: title,
          description: description,
        ),
      );
    } catch (e, st) {
      appLogger.e('Failed to update gallery details: $e', stackTrace: st);
      return false;
    }
    final updatedGallery = await apiService.getGallery(uri: galleryUri);
    if (updatedGallery != null) {
      state = {...state, galleryUri: updatedGallery};
    }
    return true;
  }

  /// Fetches timeline galleries from the API and updates the cache.
  /// Returns the list of galleries.
  Future<List<Gallery>> fetchTimeline({String? algorithm}) async {
    final galleries = await apiService.getTimeline(algorithm: algorithm);
    setGalleries(galleries);
    return galleries;
  }

  /// Updates alt text for multiple photos by calling apiService.updatePhotos, then updates the gallery cache state manually.
  /// [galleryUri]: The URI of the gallery containing the photos.
  /// [altUpdates]: List of maps with keys: photoUri, alt (and optionally aspectRatio, createdAt, photo).
  Future<bool> updatePhotoAltTexts({
    required String galleryUri,
    required List<Map<String, dynamic>> altUpdates,
  }) async {
    final res = await apiService.applyAlts(
      request: ApplyAltsRequest(
        writes: altUpdates.map((update) {
          return ApplyAltsUpdate(
            photoUri: update['photoUri'] as String,
            alt: update['alt'] as String,
          );
        }).toList(),
      ),
    );
    if (!res.success) return false;

    // Update the gallery photos' alt text in the cache manually
    final gallery = state[galleryUri];
    if (gallery == null) return false;

    // Build a map of photoUri to new alt text
    final altMap = {for (final update in altUpdates) update['photoUri'] as String: update['alt']};

    final updatedPhotos = gallery.items.map((photo) {
      final newAlt = altMap[photo.uri];
      if (newAlt != null) {
        return photo.copyWith(alt: newAlt);
      }
      return photo;
    }).toList();

    final updatedGallery = gallery.copyWith(items: updatedPhotos);
    state = {...state, galleryUri: updatedGallery};
    return true;
  }
}
