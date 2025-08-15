import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/widgets/app_image.dart';

class EditAltTextSheet extends StatefulWidget {
  final List<GalleryPhoto> photos;
  final void Function(Map<String, String?>) onSave;

  const EditAltTextSheet({super.key, required this.photos, required this.onSave});

  @override
  State<EditAltTextSheet> createState() => _EditAltTextSheetState();
}

class _EditAltTextSheetState extends State<EditAltTextSheet> {
  late Map<String, TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final photo in widget.photos) photo.uri: TextEditingController(text: photo.alt ?? ''),
    };
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _onSave() {
    final altTexts = {for (final photo in widget.photos) photo.uri: _controllers[photo.uri]?.text};
    widget.onSave(altTexts);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CupertinoPageScaffold(
      backgroundColor: theme.colorScheme.surface,
      navigationBar: CupertinoNavigationBar(
        backgroundColor: theme.colorScheme.surface,
        middle: Text(
          'Edit alt text',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          child: const Text('Cancel'),
          onPressed: () => Navigator.of(context).pop(),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _onSave,
          child: const Text('Save'),
        ),
      ),
      child: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: widget.photos.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final theme = Theme.of(context);
            final photo = widget.photos[index];
            final width = photo.aspectRatio?.width;
            final height = photo.aspectRatio?.height;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 64,
                  child: AspectRatio(
                    aspectRatio: (width != null && height != null && width > 0 && height > 0)
                        ? width / height
                        : 1.0,
                    child: AppImage(
                      url: photo.thumb ?? photo.fullsize,
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextField(
                    controller: _controllers[photo.uri],
                    decoration: InputDecoration(
                      hintText: 'Enter alt text',
                      border: InputBorder.none,
                      filled: false,
                      contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                      hintStyle: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor),
                    ),
                    style: theme.textTheme.bodyMedium,
                    cursorColor: theme.colorScheme.primary,
                    minLines: 1,
                    maxLines: 6,
                    textAlignVertical: TextAlignVertical.top,
                    scrollPhysics: const AlwaysScrollableScrollPhysics(),
                    keyboardType: TextInputType.multiline,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

Future<void> showEditAltTextSheet(
  BuildContext context, {
  required List<GalleryPhoto> photos,
  required void Function(Map<String, String?>) onSave,
}) async {
  final theme = Theme.of(context);
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: false,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: EditAltTextSheet(photos: photos, onSave: onSave),
    ),
  );
  // Restore status bar style or any other cleanup
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
}
