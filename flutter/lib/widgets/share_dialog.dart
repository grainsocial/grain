import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class ShareDialog extends StatefulWidget {
  final Gallery gallery;
  final VoidCallback onComplete;

  const ShareDialog({super.key, required this.gallery, required this.onComplete});

  @override
  State<ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<ShareDialog> {
  bool _isLoading = true;
  String? _errorMessage;
  Uint8List? _imageBytes;
  File? _imageFile;

  @override
  void initState() {
    super.initState();
    _generateComposite();
  }

  @override
  void dispose() {
    // Clean up temp file when dialog is disposed
    _cleanupTempFile();
    super.dispose();
  }

  void _cleanupTempFile() {
    if (_imageFile != null) {
      try {
        _imageFile!.delete().catchError((_) => {});
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  Future<void> _generateComposite() async {
    try {
      final imageBytes = await apiService.getGalleryCompositeImage(uri: widget.gallery.uri);

      if (imageBytes != null) {
        final uriParts = widget.gallery.uri.split('/');
        final galleryRkey = uriParts.isNotEmpty ? uriParts.last : '';
        final tempDir = await getTemporaryDirectory();
        final file = File('${tempDir.path}/gallery_composite_$galleryRkey.jpg');
        await file.writeAsBytes(imageBytes);

        setState(() {
          _isLoading = false;
          _imageBytes = imageBytes;
          _imageFile = file;
        });
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Failed to generate share image.';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to generate share image.';
      });
    }
  }

  Future<void> _copyLink() async {
    final handle = widget.gallery.creator?.handle ?? '';
    final uriParts = widget.gallery.uri.split('/');
    final galleryRkey = uriParts.isNotEmpty ? uriParts.last : '';
    final url = 'https://grain.social/profile/$handle/gallery/$galleryRkey';
    await Clipboard.setData(ClipboardData(text: url));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Link copied to clipboard'), duration: Duration(seconds: 2)),
      );
    }
  }

  Future<void> _shareLink() async {
    final handle = widget.gallery.creator?.handle ?? '';
    final uriParts = widget.gallery.uri.split('/');
    final galleryRkey = uriParts.isNotEmpty ? uriParts.last : '';
    final url = 'https://grain.social/profile/$handle/gallery/$galleryRkey';
    final shareText = "Check out this gallery on @grain.social \n$url";
    await SharePlus.instance.share(ShareParams(text: shareText));
  }

  Future<void> _shareFile() async {
    if (_imageFile != null) {
      await SharePlus.instance.share(ShareParams(files: [XFile(_imageFile!.path)]));
    } else {
      final handle = widget.gallery.creator?.handle ?? '';
      final uriParts = widget.gallery.uri.split('/');
      final galleryRkey = uriParts.isNotEmpty ? uriParts.last : '';
      final url = 'https://grain.social/profile/$handle/gallery/$galleryRkey';
      final shareText = "Check out this gallery on @grain.social \n$url";
      await SharePlus.instance.share(ShareParams(text: shareText));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: widget.onComplete),
        title: Text('Share'),
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: _isLoading
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        const SizedBox(height: 16),
                      ],
                    )
                  : _errorMessage != null
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 48),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'You can still share the gallery link',
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    )
                  : _imageBytes != null
                  ? Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Image.memory(_imageBytes!, fit: BoxFit.contain),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(color: Colors.grey[900], shape: BoxShape.circle),
                        child: IconButton(
                          onPressed: _isLoading ? null : _copyLink,
                          icon: const Padding(
                            padding: EdgeInsets.only(right: 4),
                            child: Icon(AppIcons.link, color: Colors.white, size: 18),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: 90,
                        child: Text(
                          'Copy Link',
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(color: Colors.grey[900], shape: BoxShape.circle),
                        child: IconButton(
                          onPressed: _isLoading ? null : _shareLink,
                          icon: const Padding(
                            padding: EdgeInsets.only(right: 1),
                            child: Icon(AppIcons.bluesky, color: Colors.white, size: 18),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: 90,
                        child: Text(
                          'Share Link',
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(color: Colors.grey[900], shape: BoxShape.circle),
                        child: IconButton(
                          onPressed: _isLoading ? null : _shareFile,
                          icon: const Icon(
                            AppIcons.arrowUpFromBracket,
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: 90,
                        child: Text(
                          'Share Preview',
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
