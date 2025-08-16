import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/models/procedures/delete_photo_request.dart';
import 'package:grain/providers/gallery_thread_cache_provider.dart';
import 'package:grain/widgets/add_comment_button.dart';
import 'package:grain/widgets/add_comment_sheet.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/photo_exif_dialog.dart';

class GalleryPhotoView extends ConsumerStatefulWidget {
  final List<GalleryPhoto> photos;
  final int initialIndex;
  final VoidCallback? onClose;
  final void Function(String galleryUri)? onCommentPosted;
  final dynamic gallery;
  final bool showAddCommentButton;
  final void Function(GalleryPhoto photo)? onPhotoDeleted;
  const GalleryPhotoView({
    super.key,
    required this.photos,
    required this.initialIndex,
    this.onClose,
    this.onCommentPosted,
    this.gallery,
    this.showAddCommentButton = true,
    this.onPhotoDeleted,
  });

  @override
  ConsumerState<GalleryPhotoView> createState() => _GalleryPhotoViewState();
}

class _GalleryPhotoViewState extends ConsumerState<GalleryPhotoView> {
  late PageController _controller;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _controller = PageController(initialPage: _currentIndex);
  }

  void _showPhotoOptions(BuildContext context) {
    final photo = widget.photos[_currentIndex];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(AppIcons.delete, color: Colors.red),
                title: Text('Delete photo', style: TextStyle(color: Colors.red)),
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  await _deletePhoto(context, photo);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _deletePhoto(BuildContext context, GalleryPhoto photo) async {
    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Photo'),
        content: const Text(
          'Are you sure you want to delete this photo? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      // Call the API to delete the photo
      await apiService.deletePhoto(request: DeletePhotoRequest(uri: photo.uri));

      // Notify the parent widget about the deletion
      widget.onPhotoDeleted?.call(photo);

      // Close the photo view
      if (widget.onClose != null) {
        widget.onClose!();
      } else {
        Navigator.of(context).maybePop();
      }

      // Show success message
      if (mounted && context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Photo deleted successfully')));
      }
    } catch (e) {
      // Show error message
      if (mounted && context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to delete photo: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final photo = widget.photos[_currentIndex];
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: IconButton(
          icon: Icon(AppIcons.close),
          onPressed: widget.onClose ?? () => Navigator.of(context).maybePop(),
        ),
        actions: [
          if (widget.onPhotoDeleted != null)
            IconButton(
              icon: Icon(AppIcons.moreVertical),
              onPressed: () => _showPhotoOptions(context),
            ),
        ],
      ),
      body: SafeArea(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onClose ?? () => Navigator.of(context).maybePop(),
          child: Column(
            children: [
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: widget.photos.length,
                  onPageChanged: (i) => setState(() => _currentIndex = i),
                  itemBuilder: (context, i) => Center(
                    child: AppImage(
                      url: widget.photos[i].fullsize,
                      fit: BoxFit.contain,
                      placeholder: Container(
                        color: Colors.black,
                        child: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        ),
                      ),
                      errorWidget: Container(
                        color: Colors.black,
                        child: Icon(AppIcons.brokenImage, color: Colors.grey),
                      ),
                    ),
                  ),
                ),
              ),
              if (photo.alt != null && photo.alt?.isNotEmpty == true)
                Container(
                  width: double.infinity,
                  color: Colors.black.withValues(alpha: 0.7),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Text(
                    photo.alt!,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                ),
              if (widget.showAddCommentButton)
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8, left: 16, right: 16, bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: AddCommentButton(
                            onPressed: () async {
                              final photo = widget.photos[_currentIndex];
                              final creator = widget.gallery?.creator;
                              final replyTo = {
                                'author': creator != null
                                    ? {
                                        'avatar': creator.avatar,
                                        'displayName': creator.displayName,
                                        'handle': creator.handle,
                                      }
                                    : {'avatar': null, 'displayName': '', 'handle': ''},
                                'focus': photo,
                                'text': '',
                              };
                              bool commentPosted = false;
                              await showAddCommentSheet(
                                context,
                                gallery: null,
                                replyTo: replyTo,
                                initialText: '',
                                onSubmit: (text) async {
                                  final photo = widget.photos[_currentIndex];
                                  final gallery = widget.gallery;
                                  final subject = gallery?.uri;
                                  final focus = photo.uri;
                                  if (subject == null) {
                                    return;
                                  }
                                  // Use the provider's createComment method
                                  final notifier = ref.read(
                                    galleryThreadProvider(subject).notifier,
                                  );
                                  final success = await notifier.createComment(
                                    text: text,
                                    focus: focus,
                                  );
                                  if (success) commentPosted = true;
                                  // Sheet will pop itself
                                },
                              );
                              // After sheet closes, notify parent if a comment was posted
                              if (commentPosted && widget.gallery?.uri != null) {
                                widget.onClose?.call(); // Remove GalleryPhotoView overlay
                                widget.onCommentPosted?.call(widget.gallery!.uri);
                              }
                            },
                            backgroundColor: Colors.grey[900],
                            foregroundColor: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 12),
                        if (photo.exif != null)
                          IconButton(
                            icon: Icon(Icons.camera_alt, color: Colors.white),
                            onPressed: () {
                              showDialog(
                                context: context,
                                builder: (context) => PhotoExifDialog(exif: photo.exif!),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ),
              if (!widget.showAddCommentButton && photo.exif != null)
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        icon: Icon(Icons.camera_alt, color: Colors.white),
                        onPressed: () {
                          showDialog(
                            context: context,
                            builder: (context) => PhotoExifDialog(exif: photo.exif!),
                          );
                        },
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
