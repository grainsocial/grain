import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/providers/gallery_cache_provider.dart';
import 'package:grain/widgets/app_button.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:image_picker/image_picker.dart';

import 'library_photos_select_sheet.dart';

class GalleryEditPhotosSheet extends ConsumerStatefulWidget {
  final String galleryUri;
  final List<GalleryPhoto> allPhotos;
  final void Function(List<GalleryPhoto>) onSave;

  const GalleryEditPhotosSheet({
    super.key,
    required this.galleryUri,
    required this.allPhotos,
    required this.onSave,
  });

  @override
  ConsumerState<GalleryEditPhotosSheet> createState() => _GalleryEditPhotosSheetState();
}

class _GalleryEditPhotosSheetState extends ConsumerState<GalleryEditPhotosSheet> {
  late List<GalleryPhoto> _photos;
  bool _loading = false;
  int? _deletingPhotoIndex;
  bool _includeExif = true;

  @override
  void initState() {
    super.initState();
    _photos = List.from(widget.allPhotos);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CupertinoPageScaffold(
      backgroundColor: theme.colorScheme.surface,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: theme.colorScheme.surface,
        border: Border(bottom: BorderSide(color: theme.dividerColor, width: 1)),
        middle: Text(
          'Edit photos',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: (_loading || _deletingPhotoIndex != null)
              ? null
              : () {
                  widget.onSave(_photos);
                  Navigator.of(context).maybePop();
                },
          child: Text(
            'Done',
            style: TextStyle(
              color: _deletingPhotoIndex != null ? theme.disabledColor : theme.colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 8, left: 16, right: 16, bottom: 24),
          child: Column(
            children: [
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final itemSpacing = 8.0;
                    final itemCountPerRow = 3;
                    return GridView.builder(
                      itemCount: _photos.length,
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: itemCountPerRow,
                        crossAxisSpacing: itemSpacing,
                        mainAxisSpacing: itemSpacing,
                        childAspectRatio: 1,
                      ),
                      itemBuilder: (context, index) {
                        final photo = _photos[index];
                        final isDeleting = _deletingPhotoIndex == index;
                        return Stack(
                          fit: StackFit.expand,
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                color: Colors.grey[200],
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: photo.thumb != null && photo.thumb!.isNotEmpty
                                  ? AppImage(url: photo.thumb!, fit: BoxFit.cover)
                                  : const Icon(AppIcons.photo, size: 48),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: GestureDetector(
                                onTap: (_loading || _deletingPhotoIndex != null || isDeleting)
                                    ? null
                                    : () async {
                                        final confirm = await showDialog<bool>(
                                          context: context,
                                          builder: (context) => AlertDialog(
                                            title: const Text('Remove Photo'),
                                            content: const Text(
                                              'Remove this photo from the gallery?',
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.of(context).pop(false),
                                                child: const Text('Cancel'),
                                              ),
                                              TextButton(
                                                onPressed: () => Navigator.of(context).pop(true),
                                                child: const Text('Remove'),
                                              ),
                                            ],
                                          ),
                                        );
                                        if (confirm == true && photo.gallery?.item != null) {
                                          if (!mounted) return;
                                          setState(() {
                                            _deletingPhotoIndex = index;
                                          });
                                          await ref
                                              .read(galleryCacheProvider.notifier)
                                              .removePhotoFromGallery(
                                                widget.galleryUri,
                                                photo.gallery!.item,
                                              );
                                          if (!mounted) return;
                                          setState(() {
                                            _photos.removeAt(index);
                                            _deletingPhotoIndex = null;
                                          });
                                        }
                                      },
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.grey.withOpacity(0.7),
                                    shape: BoxShape.circle,
                                  ),
                                  padding: const EdgeInsets.all(4),
                                  child: isDeleting
                                      ? SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                          ),
                                        )
                                      : const Icon(AppIcons.close, color: Colors.white, size: 20),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Upload photos',
                      loading: _loading,
                      onPressed: (_loading || _deletingPhotoIndex != null)
                          ? null
                          : () async {
                              final picker = ImagePicker();
                              final picked = await picker.pickMultiImage(imageQuality: 85);
                              if (picked.isNotEmpty) {
                                setState(() => _loading = true);
                                final notifier = ref.read(galleryCacheProvider.notifier);
                                await notifier.uploadAndAddPhotosToGallery(
                                  galleryUri: widget.galleryUri,
                                  xfiles: picked,
                                  includeExif: _includeExif,
                                );
                                // Fetch the updated gallery from provider state
                                final updatedGallery = ref.read(
                                  galleryCacheProvider,
                                )[widget.galleryUri];
                                if (updatedGallery != null && mounted) {
                                  setState(() {
                                    _photos = List.from(updatedGallery.items);
                                  });
                                }
                                if (mounted) setState(() => _loading = false);
                              }
                            },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppButton(
                      label: 'Add from library',
                      variant: AppButtonVariant.secondary,
                      onPressed: (_loading || _deletingPhotoIndex != null)
                          ? null
                          : () async {
                              final actorDid = apiService.currentUser?.did;
                              if (actorDid == null) return;
                              await showLibraryPhotosSelectSheet(
                                context,
                                actorDid: actorDid,
                                galleryUri: widget.galleryUri,
                                onSelect: (photos) async {
                                  // Wait for provider to update after adding
                                  await Future.delayed(const Duration(milliseconds: 100));
                                  final updatedGallery = ref.read(
                                    galleryCacheProvider,
                                  )[widget.galleryUri];
                                  if (updatedGallery != null && mounted) {
                                    setState(() {
                                      _photos = List.from(updatedGallery.items);
                                    });
                                  }
                                },
                              );
                            },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text('Include image metadata (EXIF)', style: theme.textTheme.bodyMedium),
                  ),
                  Switch(
                    value: _includeExif,
                    onChanged: (_loading || _deletingPhotoIndex != null)
                        ? null
                        : (val) {
                            setState(() {
                              _includeExif = val;
                            });
                          },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showGalleryEditPhotosSheet(
  BuildContext context, {
  required String galleryUri,
  required List<GalleryPhoto> allPhotos,
  required void Function(List<GalleryPhoto>) onSave,
}) async {
  final theme = Theme.of(context);
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: true,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: GalleryEditPhotosSheet(galleryUri: galleryUri, allPhotos: allPhotos, onSave: onSave),
    ),
  );
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
}
