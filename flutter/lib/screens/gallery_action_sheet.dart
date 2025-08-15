import 'package:flutter/material.dart';
import 'package:grain/app_icons.dart';

class GalleryActionSheet extends StatelessWidget {
  final VoidCallback? onEditDetails;
  final VoidCallback? onEditPhotos;
  final VoidCallback? onChangeSortOrder;
  final Future<void> Function(BuildContext parentContext)? onDeleteGallery;
  final BuildContext parentContext;
  final VoidCallback? onEditAltText;

  const GalleryActionSheet({
    super.key,
    required this.parentContext,
    this.onEditDetails,
    this.onEditPhotos,
    this.onEditAltText,
    this.onChangeSortOrder,
    this.onDeleteGallery,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: Icon(AppIcons.edit),
            title: const Text('Edit details'),
            onTap: () {
              Navigator.of(context).pop();
              if (onEditDetails != null) onEditDetails!();
            },
          ),
          ListTile(
            leading: Icon(AppIcons.photoLibrary),
            title: const Text('Edit photos'),
            onTap: () {
              Navigator.of(context).pop();
              if (onEditPhotos != null) onEditPhotos!();
            },
          ),
          ListTile(
            leading: Icon(AppIcons.edit),
            title: const Text('Edit alt text'),
            onTap: () {
              Navigator.of(context).pop();
              if (onEditAltText != null) onEditAltText!();
            },
          ),
          ListTile(
            leading: Icon(AppIcons.sort),
            title: const Text('Edit sort order'),
            onTap: () {
              Navigator.of(context).pop();
              if (onChangeSortOrder != null) onChangeSortOrder!();
            },
          ),
          ListTile(
            leading: Icon(AppIcons.delete, color: Colors.red),
            title: const Text('Delete gallery', style: TextStyle(color: Colors.red)),
            onTap: () async {
              Navigator.of(context).pop();
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Delete Gallery'),
                  content: const Text(
                    'Are you sure you want to delete this gallery? This action cannot be undone.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                      child: const Text('Delete'),
                    ),
                  ],
                ),
              );
              if (confirm == true && onDeleteGallery != null) await onDeleteGallery!(parentContext);
            },
          ),
        ],
      ),
    );
  }
}
