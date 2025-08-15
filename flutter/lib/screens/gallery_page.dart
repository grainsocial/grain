import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/providers/gallery_cache_provider.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:grain/screens/comments_page.dart';
import 'package:grain/screens/create_gallery_page.dart';
import 'package:grain/screens/edit_alt_text_sheet.dart';
import 'package:grain/screens/gallery_action_sheet.dart';
import 'package:grain/screens/gallery_edit_photos_sheet.dart';
import 'package:grain/screens/gallery_sort_order_sheet.dart';
import 'package:grain/screens/hashtag_page.dart';
import 'package:grain/screens/home_page.dart';
import 'package:grain/screens/profile_page.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/camera_pills.dart';
import 'package:grain/widgets/faceted_text.dart';
import 'package:grain/widgets/gallery_action_buttons.dart';
import 'package:grain/widgets/gallery_photo_view.dart';
import 'package:grain/widgets/justified_gallery_view.dart';
import 'package:url_launcher/url_launcher.dart';

class GalleryPage extends ConsumerStatefulWidget {
  final String uri;
  final String? currentUserDid;
  const GalleryPage({super.key, required this.uri, this.currentUserDid});

  @override
  ConsumerState<GalleryPage> createState() => _GalleryPageState();
}

class _GalleryPageState extends ConsumerState<GalleryPage> {
  bool _loading = true;
  bool _error = false;
  GalleryPhoto? _selectedPhoto;
  int? _selectedPhotoIndex;

  @override
  void initState() {
    super.initState();
    // Only fetch if not already in cache
    final cached = ref.read(galleryCacheProvider)[widget.uri];
    if (cached == null) {
      _maybeFetchGallery();
    } else {
      setState(() {
        _loading = false;
        _error = false;
      });
    }
  }

  Future<void> _maybeFetchGallery({bool forceRefresh = false}) async {
    // Only fetch from API if not in cache or forceRefresh is true
    if (!forceRefresh) {
      final cached = ref.read(galleryCacheProvider)[widget.uri];
      if (cached != null) {
        setState(() {
          _loading = false;
          _error = false;
        });
        return;
      }
    }
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final gallery = await apiService.getGallery(uri: widget.uri);
      if (gallery != null) {
        ref.read(galleryCacheProvider.notifier).setGallery(gallery);
        setState(() {
          _loading = false;
        });
      } else {
        setState(() {
          _error = true;
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gallery = ref.watch(galleryCacheProvider)[widget.uri];
    if (_loading) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: Center(child: CircularProgressIndicator(strokeWidth: 2, color: theme.primaryColor)),
      );
    }
    if (_error || gallery == null) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: const Center(child: Text('Failed to load gallery.')),
      );
    }
    final isLoggedIn = widget.currentUserDid != null;
    final galleryItems = gallery.items.where((item) => item.thumb?.isNotEmpty ?? false).toList();

    return Stack(
      children: [
        Scaffold(
          backgroundColor: theme.scaffoldBackgroundColor,
          appBar: AppBar(
            backgroundColor: theme.appBarTheme.backgroundColor,
            surfaceTintColor: theme.appBarTheme.backgroundColor,
            title: Text('Gallery'),
            iconTheme: theme.appBarTheme.iconTheme,
            titleTextStyle: theme.appBarTheme.titleTextStyle,
            actions: [
              if (gallery.creator?.did == widget.currentUserDid)
                IconButton(
                  icon: const Icon(AppIcons.moreVertical),
                  tooltip: 'Gallery Actions',
                  onPressed: () async {
                    showModalBottomSheet(
                      context: context,
                      builder: (sheetContext) => GalleryActionSheet(
                        parentContext: context,
                        onEditDetails: () async {
                          await showCreateGallerySheet(context, gallery: gallery);
                          _maybeFetchGallery();
                        },
                        onEditPhotos: () {
                          showGalleryEditPhotosSheet(
                            context,
                            galleryUri: gallery.uri,
                            allPhotos: gallery.items,
                            onSave: (newSelection) {
                              // TODO: Save new selection to backend and refresh gallery
                            },
                          );
                        },
                        onEditAltText: () {
                          showEditAltTextSheet(
                            context,
                            photos: gallery.items,
                            onSave: (altTexts) async {
                              // altTexts: Map<String, String?> (photoUri -> alt)
                              final altUpdates = altTexts.entries
                                  .map((e) => {'photoUri': e.key, 'alt': e.value})
                                  .toList();
                              await ref
                                  .read(galleryCacheProvider.notifier)
                                  .updatePhotoAltTexts(
                                    galleryUri: gallery.uri,
                                    altUpdates: altUpdates,
                                  );
                            },
                          );
                        },
                        onChangeSortOrder: () {
                          showGallerySortOrderSheet(
                            context,
                            photos: galleryItems,
                            onReorderDone: (newOrder, sheetContext) async {
                              await ref
                                  .read(galleryCacheProvider.notifier)
                                  .reorderGalleryItems(galleryUri: gallery.uri, newOrder: newOrder);
                              if (!sheetContext.mounted) return;
                              Navigator.of(sheetContext).pop();
                              if (!mounted) return;
                              Navigator.of(context).pop();
                            },
                          );
                        },
                        onDeleteGallery: (sheetContext) async {
                          await ref.read(galleryCacheProvider.notifier).deleteGallery(gallery.uri);
                          ref
                              .read(profileNotifierProvider(widget.currentUserDid!).notifier)
                              .removeGalleryFromProfile(gallery.uri);
                          if (!sheetContext.mounted) return;
                          Navigator.of(sheetContext).pop(); // Close the action sheet
                          if (!mounted) return;
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(
                              builder: (_) => HomePage(
                                title: 'Grain',
                                initialTab: 3, // Profile tab
                                did: widget.currentUserDid,
                              ),
                            ),
                            (route) => false,
                          );
                          return;
                        },
                      ),
                    );
                  },
                ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () => _maybeFetchGallery(forceRefresh: true),
            child: ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 10),
                      Text(
                        gallery.title?.isNotEmpty == true ? gallery.title! : 'Gallery',
                        style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          GestureDetector(
                            onTap: gallery.creator != null && gallery.creator!.did.isNotEmpty
                                ? () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (context) => ProfilePage(
                                          did: gallery.creator!.did,
                                          showAppBar: true,
                                        ),
                                      ),
                                    );
                                  }
                                : null,
                            child: CircleAvatar(
                              radius: 18,
                              backgroundColor: theme.colorScheme.surfaceContainerHighest,
                              backgroundImage:
                                  gallery.creator?.avatar != null &&
                                      gallery.creator!.avatar?.isNotEmpty == true
                                  ? null
                                  : null,
                              child:
                                  (gallery.creator == null ||
                                      (gallery.creator!.avatar?.isNotEmpty != true))
                                  ? Icon(
                                      AppIcons.accountCircle,
                                      size: 24,
                                      color: theme.colorScheme.onSurface.withOpacity(0.4),
                                    )
                                  : ClipOval(
                                      child: AppImage(
                                        url: gallery.creator!.avatar!,
                                        width: 36,
                                        height: 36,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: GestureDetector(
                              onTap: gallery.creator != null && gallery.creator!.did.isNotEmpty
                                  ? () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (context) => ProfilePage(
                                            did: gallery.creator!.did,
                                            showAppBar: true,
                                          ),
                                        ),
                                      );
                                    }
                                  : null,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    gallery.creator?.displayName ?? '',
                                    style: theme.textTheme.bodyLarge?.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if ((gallery.creator?.handle ?? '').isNotEmpty)
                                    Text(
                                      '@${gallery.creator?.handle ?? ''}',
                                      style: theme.textTheme.bodyMedium?.copyWith(
                                        color: theme.hintColor,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if ((gallery.description?.isNotEmpty ?? false))
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8).copyWith(bottom: 8),
                    child: FacetedText(
                      text: gallery.description ?? '',
                      facets: gallery.facets,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface,
                      ),
                      linkStyle: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                      onMentionTap: (did) {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => ProfilePage(did: did, showAppBar: true),
                          ),
                        );
                      },
                      onLinkTap: (url) async {
                        final uri = Uri.parse(url);
                        if (!await launchUrl(uri)) {
                          throw Exception('Could not launch $url');
                        }
                      },
                      onTagTap: (tag) => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => HashtagPage(hashtag: tag)),
                      ),
                    ),
                  ),
                if ((gallery.cameras?.isNotEmpty ?? false))
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    child: CameraPills(cameras: gallery.cameras!),
                  ),
                if (isLoggedIn)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: GalleryActionButtons(
                      gallery: gallery,
                      parentContext: context,
                      currentUserDid: widget.currentUserDid,
                      isLoggedIn: isLoggedIn,
                    ),
                  ),
                const SizedBox(height: 8),
                // Gallery items grid (edge-to-edge)
                if (galleryItems.isNotEmpty)
                  JustifiedGalleryView(
                    items: galleryItems,
                    onImageTap: (index) {
                      if (index >= 0 && index < galleryItems.length) {
                        setState(() {
                          _selectedPhoto = galleryItems[index];
                          _selectedPhotoIndex = index;
                        });
                      }
                    },
                  ),
                if (galleryItems.isEmpty)
                  Center(
                    child: Text('No photos in this gallery.', style: theme.textTheme.bodyMedium),
                  ),
              ],
            ),
          ),
        ),
        if (_selectedPhoto != null && _selectedPhotoIndex != null)
          Positioned.fill(
            child: Stack(
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedPhoto = null;
                      _selectedPhotoIndex = null;
                    });
                  },
                  child: Container(color: Colors.black.withOpacity(0.85)),
                ),
                Center(
                  child: GalleryPhotoView(
                    photos: galleryItems,
                    initialIndex: _selectedPhotoIndex!,
                    onClose: () {
                      setState(() {
                        _selectedPhoto = null;
                        _selectedPhotoIndex = null;
                      });
                    },
                    onCommentPosted: (galleryUri) async {
                      setState(() => _selectedPhoto = null); // Remove overlay
                      await Future.delayed(const Duration(milliseconds: 200));
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted) {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => CommentsPage(galleryUri: galleryUri),
                            ),
                          );
                        }
                      });
                    },
                    gallery: gallery, // Pass the gallery object
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
