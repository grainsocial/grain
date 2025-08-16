import 'package:flutter/material.dart';
import 'package:grain/models/gallery_photo.dart';
import 'package:grain/widgets/app_image.dart';

class JustifiedGalleryView extends StatelessWidget {
  final List<GalleryPhoto> items;
  final double spacing;
  final double maxRowHeight;
  final void Function(int index)? onImageTap;

  const JustifiedGalleryView({
    super.key,
    required this.items,
    this.spacing = 2, // Reduced from 4 to 2 for tighter, profile-like spacing
    this.maxRowHeight = 220,
    this.onImageTap,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(child: Text('No photos in this gallery.'));
    }
    final screenWidth = MediaQuery.of(context).size.width;
    final rows = _computeRows(items, screenWidth, spacing, maxRowHeight);
    final List<Widget> rowWidgets = [];
    for (final row in rows) {
      rowWidgets.add(
        Padding(
          padding: EdgeInsets.only(bottom: spacing),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              for (int i = 0; i < row.length; i++)
                Padding(
                  padding: EdgeInsets.only(right: i == row.length - 1 ? 0 : spacing),
                  child: GestureDetector(
                    onTap: onImageTap != null ? () => onImageTap!(row[i].originalIndex) : null,
                    child: SizedBox(
                      width: row[i].displayWidth,
                      height: row[i].displayHeight,
                      child: ClipRRect(
                        child: Stack(
                          children: [
                            AppImage(url: row[i].thumb, fit: BoxFit.cover),
                            if (items[row[i].originalIndex].alt != null &&
                                items[row[i].originalIndex].alt!.trim().isNotEmpty)
                              Positioned(
                                bottom: 4,
                                right: 4,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.7),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: const Text(
                                    'ALT',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rowWidgets);
  }
}

class _JustifiedImage {
  final String thumb;
  final double displayWidth;
  final double displayHeight;
  final int originalIndex;

  _JustifiedImage({
    required this.thumb,
    required this.displayWidth,
    required this.displayHeight,
    required this.originalIndex,
  });
}

List<List<_JustifiedImage>> _computeRows(
  List<GalleryPhoto> items,
  double maxWidth,
  double spacing,
  double maxRowHeight,
) {
  final rows = <List<_JustifiedImage>>[];
  var currentRow = <_JustifiedImage>[];
  double aspectSum = 0;
  for (var i = 0; i < items.length; i++) {
    final item = items[i];
    // Use aspectRatio model if available, fallback to 4:3
    final imgW = (item.aspectRatio != null && item.aspectRatio!.width > 0)
        ? item.aspectRatio!.width.toDouble()
        : 4.0;
    final imgH = (item.aspectRatio != null && item.aspectRatio!.height > 0)
        ? item.aspectRatio!.height.toDouble()
        : 3.0;
    final aspect = imgW / imgH;
    currentRow.add(
      _JustifiedImage(
        thumb: item.thumb ?? '',
        displayWidth: 0, // placeholder, will be set later
        displayHeight: 0, // placeholder, will be set later
        originalIndex: i,
      ),
    );
    aspectSum += aspect;
    // Estimate row height
    final rowSpacing = spacing * (currentRow.length - 1);
    final estRowHeight = (maxWidth - rowSpacing) / aspectSum;
    // If row is full enough or last image, finalize row
    if (estRowHeight < maxRowHeight || i == items.length - 1) {
      final rowHeight = estRowHeight.clamp(80.0, maxRowHeight);
      for (var j = 0; j < currentRow.length; j++) {
        final img = items[i - currentRow.length + 1 + j];
        final imgW2 = (img.aspectRatio != null && img.aspectRatio!.width > 0)
            ? img.aspectRatio!.width.toDouble()
            : 4.0;
        final imgH2 = (img.aspectRatio != null && img.aspectRatio!.height > 0)
            ? img.aspectRatio!.height.toDouble()
            : 3.0;
        final width = rowHeight * (imgW2 / imgH2);
        currentRow[j] = _JustifiedImage(
          thumb: img.thumb ?? '',
          displayWidth: width,
          displayHeight: rowHeight.toDouble(),
          originalIndex: i - currentRow.length + 1 + j,
        );
      }
      rows.add(List<_JustifiedImage>.from(currentRow));
      currentRow = <_JustifiedImage>[];
      aspectSum = 0;
    }
  }
  return rows;
}
