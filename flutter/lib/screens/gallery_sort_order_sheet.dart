import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:reorderables/reorderables.dart';

class GallerySortOrderSheet extends StatefulWidget {
  final List<GalleryPhoto> photos;
  final void Function(List<GalleryPhoto>, BuildContext) onReorderDone;

  const GallerySortOrderSheet({super.key, required this.photos, required this.onReorderDone});

  @override
  State<GallerySortOrderSheet> createState() => _GallerySortOrderSheetState();
}

class _GallerySortOrderSheetState extends State<GallerySortOrderSheet> {
  late List<GalleryPhoto> _photos;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _photos = List.from(widget.photos);
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
          'Edit sort order',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
          child: Text(
            'Cancel',
            style: TextStyle(
              color: _saving ? Colors.grey : theme.colorScheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: _saving
              ? null
              : () {
                  setState(() => _saving = true);
                  widget.onReorderDone(_photos, context);
                  if (mounted) setState(() => _saving = false);
                },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Save',
                style: TextStyle(
                  color: _saving ? Colors.grey : theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (_saving) ...[
                const SizedBox(width: 8),
                SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ],
            ],
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 24),
          child: Column(
            children: [
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final gridWidth = constraints.maxWidth;
                    final itemSpacing = 8.0;
                    final itemCountPerRow = 3;
                    final itemWidth =
                        (gridWidth - (itemSpacing * (itemCountPerRow - 1))) / itemCountPerRow;
                    return SingleChildScrollView(
                      child: ReorderableWrap(
                        spacing: itemSpacing,
                        runSpacing: itemSpacing,
                        minMainAxisCount: itemCountPerRow,
                        maxMainAxisCount: itemCountPerRow,
                        onReorder: (oldIndex, newIndex) {
                          setState(() {
                            final item = _photos.removeAt(oldIndex);
                            _photos.insert(newIndex, item);
                          });
                        },
                        children: [
                          for (final photo in _photos)
                            Container(
                              key: ValueKey(photo.thumb ?? photo.hashCode),
                              width: itemWidth,
                              height: itemWidth,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                color: Colors.grey[200],
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: photo.thumb != null && photo.thumb!.isNotEmpty
                                  ? AppImage(url: photo.thumb!, fit: BoxFit.cover)
                                  : Icon(AppIcons.photo, size: 48),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showGallerySortOrderSheet(
  BuildContext context, {
  required List<GalleryPhoto> photos,
  required void Function(List<GalleryPhoto>, BuildContext) onReorderDone,
}) async {
  final theme = Theme.of(context);
  await showCupertinoSheet(
    context: context,
    useNestedNavigation: true,
    pageBuilder: (context) => Material(
      type: MaterialType.transparency,
      child: GallerySortOrderSheet(photos: photos, onReorderDone: onReorderDone),
    ),
  );
  SystemChrome.setSystemUIOverlayStyle(
    theme.brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  );
}
