import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:grain/widgets/app_button.dart';
import 'package:grain/widgets/faceted_text_field.dart';
import 'package:grain/widgets/plain_text_field.dart';
import 'package:grain/widgets/upload_progress_overlay.dart';
import 'package:image_picker/image_picker.dart';

import '../providers/gallery_cache_provider.dart';
import 'gallery_page.dart';

// Wrapper class for differentiating images
class GalleryImage {
  final XFile file;
  final bool isExisting;
  final String? remoteUri;
  GalleryImage({required this.file, this.isExisting = false, this.remoteUri});
}

class CreateGalleryPage extends StatefulWidget {
  final Gallery? gallery;
  const CreateGalleryPage({super.key, this.gallery});

  @override
  State<CreateGalleryPage> createState() => _CreateGalleryPageState();
}

class _CreateGalleryPageState extends State<CreateGalleryPage> {
  bool isValidGraphemeLength(String input, int maxLength) {
    return input.characters.length <= maxLength;
  }

  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final List<GalleryImage> _images = [];
  bool _submitting = false;
  bool _includeExif = true;

  // Upload progress state
  bool _showUploadOverlay = false;
  int _currentUploadIndex = 0;
  double _currentUploadProgress = 0.0;

  @override
  void initState() {
    super.initState();
    if (widget.gallery != null) {
      _titleController.text = widget.gallery?.title ?? '';
      _descController.text = widget.gallery?.description ?? '';
    }
    _titleController.addListener(() {
      setState(() {});
    });
    _descController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<String> _computeMd5(XFile xfile) async {
    final bytes = await xfile.readAsBytes();
    return md5.convert(bytes).toString();
  }

  Future<void> _pickImages() async {
    if (widget.gallery != null) return; // Only allow picking on create

    final remainingSlots = 10 - _images.length;
    if (remainingSlots <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You\'ve already added the maximum of 10 photos.'),
            duration: Duration(seconds: 2),
          ),
        );
      }
      return;
    }

    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 85);
    if (picked.isNotEmpty) {
      // Use md5 hash for duplicate detection
      final existingHashes = <String>{};
      for (final img in _images) {
        final hash = await _computeMd5(img.file);
        existingHashes.add(hash);
      }

      final newImages = <GalleryImage>[];
      int skipped = 0;
      int limitReached = 0;

      for (final xfile in picked) {
        // Check if we've reached the limit
        if (_images.length + newImages.length >= 10) {
          limitReached = picked.length - picked.indexOf(xfile);
          break;
        }

        final hash = await _computeMd5(xfile);
        if (!existingHashes.contains(hash)) {
          newImages.add(GalleryImage(file: xfile, isExisting: false));
          existingHashes.add(hash);
        } else {
          skipped++;
        }
      }

      if (newImages.isNotEmpty) {
        setState(() {
          _images.addAll(newImages);
        });
      }

      // Show appropriate feedback messages
      if (mounted) {
        String message = '';
        if (limitReached > 0 && skipped > 0) {
          message =
              'Added ${newImages.length} photos. $skipped duplicates and $limitReached photos skipped (10 photo limit).';
        } else if (limitReached > 0) {
          message =
              'Added ${newImages.length} photos. $limitReached photos skipped (10 photo limit).';
        } else if (skipped > 0) {
          message = 'Added ${newImages.length} photos. $skipped duplicates skipped.';
        }

        if (message.isNotEmpty) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 3)));
        }
      }
    }
  }

  void _removeImage(int index) {
    setState(() {
      _images.removeAt(index);
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    final titleGraphemes = _titleController.text.characters.length;
    final descGraphemes = _descController.text.characters.length;
    if (titleGraphemes > 100 || descGraphemes > 1000) {
      if (mounted) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Character Limit Exceeded'),
            content: Text(
              titleGraphemes > 100
                  ? 'Title must be 100 characters or fewer.'
                  : 'Description must be 1000 characters or fewer.',
            ),
            actions: [
              TextButton(child: const Text('OK'), onPressed: () => Navigator.of(context).pop()),
            ],
          ),
        );
      }
      return;
    }
    if (widget.gallery == null && _images.length > 10) {
      if (mounted) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Photo Limit'),
            content: const Text(
              'You can only add up to 10 photos initially but you can add more later on.',
            ),
            actions: [
              TextButton(child: const Text('OK'), onPressed: () => Navigator.of(context).pop()),
            ],
          ),
        );
      }
      return;
    }
    setState(() => _submitting = true);
    String? galleryUri;
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      if (widget.gallery == null) {
        final newImages = _images.where((img) => !img.isExisting).toList();
        final galleryCache = container.read(galleryCacheProvider.notifier);
        if (newImages.isNotEmpty) {
          setState(() {
            _showUploadOverlay = true;
            _currentUploadIndex = 0;
            _currentUploadProgress = 0.0;
          });
        }
        List<XFile> xfiles = newImages.map((img) => img.file).toList();
        String? createdUri;
        final (uri, photoUris) = await galleryCache.createGalleryAndAddPhotos(
          title: _titleController.text.trim(),
          description: _descController.text.trim(),
          xfiles: xfiles,
          includeExif: _includeExif,
          onProgress: (int idx, double prog) {
            setState(() {
              _currentUploadIndex = idx;
              _currentUploadProgress = prog;
            });
          },
        );
        createdUri = uri;
        setState(() {
          _showUploadOverlay = false;
        });
        galleryUri = createdUri;
        // Update profile provider state to include new gallery
        if (galleryUri != null && mounted) {
          final newGallery = container.read(galleryCacheProvider)[galleryUri];
          final profileNotifier = container.read(
            profileNotifierProvider(apiService.currentUser!.did).notifier,
          );
          if (newGallery != null) {
            profileNotifier.addGalleryToProfile(newGallery);
          }
        }
      } else {
        galleryUri = widget.gallery!.uri;
        final galleryCache = container.read(galleryCacheProvider.notifier);
        await galleryCache.updateGalleryDetails(
          galleryUri: galleryUri,
          title: _titleController.text.trim(),
          description: _descController.text.trim(),
          createdAt: widget.gallery!.createdAt ?? DateTime.now().toUtc().toIso8601String(),
        );
      }
      setState(() => _submitting = false);
      if (mounted && galleryUri != null) {
        FocusScope.of(context).unfocus(); // Force keyboard to close
        Navigator.of(context).pop(galleryUri); // Pop with galleryUri if created
        if (widget.gallery == null) {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) =>
                  GalleryPage(uri: galleryUri!, currentUserDid: apiService.currentUser?.did),
            ),
          );
        }
      } else if (mounted) {
        FocusScope.of(context).unfocus(); // Force keyboard to close
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() {
        _submitting = false;
        _showUploadOverlay = false;
      });
      if (mounted) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Upload Failed'),
            content: Text('An error occurred while uploading:\n\n${e.toString()}'),
            actions: [
              TextButton(child: const Text('OK'), onPressed: () => Navigator.of(context).pop()),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Stack(
      children: [
        Positioned.fill(
          child: CupertinoPageScaffold(
            backgroundColor: theme.colorScheme.surface,
            navigationBar: CupertinoNavigationBar(
              backgroundColor: theme.colorScheme.surface,
              border: Border(bottom: BorderSide(color: theme.dividerColor, width: 1)),
              middle: Text(
                widget.gallery == null ? 'New Gallery' : 'Edit Gallery',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              leading: CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _submitting
                    ? null
                    : () {
                        FocusScope.of(context).unfocus(); // Force keyboard to close
                        Navigator.of(context).pop();
                      },
                child: Text(
                  'Cancel',
                  style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                ),
              ),
              trailing: CupertinoButton(
                padding: EdgeInsets.zero,
                onPressed: _submitting || _titleController.text.trim().isEmpty ? null : _submit,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.gallery == null ? 'Create' : 'Save',
                      style: TextStyle(
                        color: (_submitting || _titleController.text.trim().isEmpty)
                            ? theme.disabledColor
                            : theme.colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (_submitting) ...[
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
                          semanticsLabel: widget.gallery == null ? 'Creating' : 'Saving',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            child: SafeArea(
              bottom: true,
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: () => FocusScope.of(context).unfocus(),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      PlainTextField(
                        label: 'Title',
                        controller: _titleController,
                        hintText: 'Enter a title',
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const SizedBox(),
                            Text(
                              '${_titleController.text.characters.length}/100',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: _titleController.text.characters.length > 100
                                    ? theme.colorScheme.error
                                    : theme.textTheme.bodySmall?.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      FacetedTextField(
                        label: 'Description',
                        controller: _descController,
                        maxLines: 6,
                        hintText: 'Enter a description',
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const SizedBox(),
                            Text(
                              '${_descController.text.characters.length}/1000',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: _descController.text.characters.length > 1000
                                    ? theme.colorScheme.error
                                    : theme.textTheme.bodySmall?.color,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (widget.gallery == null)
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Include image metadata (EXIF)',
                                style: theme.textTheme.bodyMedium,
                              ),
                            ),
                            Switch(
                              value: _includeExif,
                              onChanged: (val) {
                                setState(() {
                                  _includeExif = val;
                                });
                              },
                            ),
                          ],
                        ),
                      const SizedBox(height: 16),
                      if (widget.gallery == null) ...[
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Text(
                            "You can add up to 10 photos when initially creating a gallery, but you can add more later on. Galleries can capture a moment in time or evolve as an ongoing collection.",
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor),
                          ),
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: AppButton(
                                label: _images.length >= 10
                                    ? 'Photos limit reached (10/10)'
                                    : 'Add photos (${_images.length}/10)',
                                onPressed: _images.length >= 10 ? null : _pickImages,
                                icon: AppIcons.photoLibrary,
                                variant: AppButtonVariant.primary,
                                height: 40,
                                fontSize: 15,
                                borderRadius: 6,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (_images.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                          itemCount: _images.length,
                          itemBuilder: (context, index) {
                            final galleryImage = _images[index];
                            return Stack(
                              children: [
                                Positioned.fill(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: theme.colorScheme.surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.file(
                                        File(galleryImage.file.path),
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                ),
                                if (galleryImage.isExisting)
                                  Positioned(
                                    left: 2,
                                    top: 2,
                                    child: Container(
                                      padding: const EdgeInsets.all(2),
                                      decoration: BoxDecoration(
                                        color: theme.colorScheme.secondary.withOpacity(0.7),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Icon(
                                        AppIcons.checkCircle,
                                        color: theme.colorScheme.onSecondary,
                                        size: 16,
                                      ),
                                    ),
                                  ),
                                Positioned(
                                  top: 2,
                                  right: 2,
                                  child: GestureDetector(
                                    onTap: () => _removeImage(index),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.grey.withOpacity(0.7),
                                        shape: BoxShape.circle,
                                      ),
                                      padding: const EdgeInsets.all(4),
                                      child: const Icon(
                                        AppIcons.close,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (_showUploadOverlay && widget.gallery == null) ...[
          UploadProgressOverlay(
            images: _images.where((img) => !img.isExisting).toList(),
            currentIndex: _currentUploadIndex,
            progress: _currentUploadProgress,
            visible: _showUploadOverlay,
          ),
        ],
      ],
    );
  }
}

Future<String?> showCreateGallerySheet(BuildContext context, {Gallery? gallery}) async {
  final theme = Theme.of(context);

  FocusScope.of(context).unfocus();

  final result = await showCupertinoSheet(
    context: context,
    useNestedNavigation: false,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: CreateGalleryPage(gallery: gallery),
    ),
  );

  // Restore status bar style or any other cleanup
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
  return result as String?;
}
