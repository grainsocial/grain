import 'package:flutter/material.dart';
import 'package:grain/models/gallery.dart';
import 'package:grain/widgets/app_image.dart';

class GalleryPreview extends StatelessWidget {
  final Gallery gallery;

  const GalleryPreview({super.key, required this.gallery});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final Color bgColor = theme.brightness == Brightness.dark
        ? Colors.grey[850]!
        : Colors.grey[200]!;
    final photos = gallery.items
        .where((item) => item.thumb != null && item.thumb!.isNotEmpty)
        .toList();
    return AspectRatio(
      aspectRatio: 3 / 2,
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: photos.isNotEmpty
                ? AppImage(
                    url: photos[0].thumb,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: double.infinity,
                  )
                : Container(color: theme.colorScheme.surfaceContainerHighest),
          ),
          const SizedBox(width: 2),
          Expanded(
            flex: 1,
            child: Column(
              children: [
                Expanded(
                  child: photos.length > 1
                      ? AppImage(
                          url: photos[1].thumb,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        )
                      : Container(color: bgColor),
                ),
                const SizedBox(height: 2),
                Expanded(
                  child: photos.length > 2
                      ? AppImage(
                          url: photos[2].thumb,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        )
                      : Container(color: bgColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
