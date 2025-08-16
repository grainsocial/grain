import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/providers/gallery_cache_provider.dart';
import 'package:grain/widgets/app_button.dart';
import 'package:grain/widgets/app_image.dart';

class LibraryPhotosSelectSheet extends ConsumerStatefulWidget {
  final String actorDid;
  final String galleryUri;
  final void Function(List<GalleryPhoto>) onSelect;

  const LibraryPhotosSelectSheet({
    super.key,
    required this.actorDid,
    required this.galleryUri,
    required this.onSelect,
  });

  @override
  ConsumerState<LibraryPhotosSelectSheet> createState() => _LibraryPhotosSelectSheetState();
}

class _LibraryPhotosSelectSheetState extends ConsumerState<LibraryPhotosSelectSheet> {
  List<GalleryPhoto> _photos = [];
  final Set<int> _selectedIndexes = {};
  bool _loading = true;
  bool _addingItems = false;

  @override
  void initState() {
    super.initState();
    _fetchPhotos();
  }

  Future<void> _fetchPhotos() async {
    setState(() => _loading = true);
    final photos = await apiService.fetchActorPhotos(did: widget.actorDid);
    // Get gallery items from provider
    final galleryItems = ref.read(galleryCacheProvider)[widget.galleryUri]?.items ?? [];
    final galleryUris = galleryItems.map((item) => item.uri).toSet();
    // Filter out photos already in gallery
    final filteredPhotos = photos.where((photo) => !galleryUris.contains(photo.uri)).toList();
    if (mounted) {
      setState(() {
        _photos = filteredPhotos;
        _loading = false;
      });
    }
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
          'Select Photos from Library',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: (_loading || _addingItems) ? null : () => Navigator.of(context).maybePop(),
          child: Text(
            'Cancel',
            style: TextStyle(
              color: _addingItems ? Colors.grey : theme.colorScheme.primary,
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
                child: _loading
                    ? Center(child: CircularProgressIndicator())
                    : GridView.builder(
                        itemCount: _photos.length,
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                          childAspectRatio: 1,
                        ),
                        itemBuilder: (context, index) {
                          final photo = _photos[index];
                          final selected = _selectedIndexes.contains(index);
                          return GestureDetector(
                            onTap: () {
                              setState(() {
                                if (selected) {
                                  _selectedIndexes.remove(index);
                                } else {
                                  _selectedIndexes.add(index);
                                }
                              });
                            },
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    color: Colors.grey[200],
                                    // Remove border highlight for selected
                                    // borderRadius already specified above
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      photo.thumb != null && photo.thumb!.isNotEmpty
                                          ? AppImage(url: photo.thumb!, fit: BoxFit.cover)
                                          : Icon(AppIcons.photo, size: 48),
                                      if (selected) ...[
                                        Container(
                                          decoration: BoxDecoration(
                                            color: Colors.black.withOpacity(0.25),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                        ),
                                        Positioned(
                                          top: 8,
                                          right: 8,
                                          child: FaIcon(
                                            AppIcons.checkCircle,
                                            color: Colors.white,
                                            size: 24,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 16),
              AppButton(
                label: _selectedIndexes.isEmpty
                    ? 'Add Selected Photos'
                    : 'Add Selected (${_selectedIndexes.length}) Photos',
                loading: _addingItems,
                onPressed: _loading || _addingItems || _selectedIndexes.isEmpty
                    ? null
                    : () async {
                        setState(() => _addingItems = true);
                        final selectedPhotos = _selectedIndexes.map((i) => _photos[i]).toList();
                        final photoUris = selectedPhotos.map((p) => p.uri).toList();
                        // Call provider to add gallery items
                        await ref
                            .read(galleryCacheProvider.notifier)
                            .addGalleryItemsToGallery(
                              galleryUri: widget.galleryUri,
                              photoUris: photoUris,
                            );
                        widget.onSelect(selectedPhotos);
                        if (mounted) setState(() => _addingItems = false);
                        if (!context.mounted) return;
                        Navigator.of(context).maybePop();
                      },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showLibraryPhotosSelectSheet(
  BuildContext context, {
  required String actorDid,
  required String galleryUri,
  required void Function(List<GalleryPhoto>) onSelect,
}) async {
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: true,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: LibraryPhotosSelectSheet(
        actorDid: actorDid,
        galleryUri: galleryUri,
        onSelect: onSelect,
      ),
    ),
  );
}
