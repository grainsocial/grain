import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/app_theme.dart';
import 'package:grain/models/gallery.dart';
import 'package:grain/providers/gallery_cache_provider.dart';

import '../screens/comments_page.dart';
import 'share_dialog.dart';

class GalleryActionButtons extends ConsumerWidget {
  final Gallery gallery;
  final String? currentUserDid;
  final BuildContext parentContext;
  final VoidCallback? onFavorite;
  final VoidCallback? onComment;
  final VoidCallback? onShare;
  final bool isLoggedIn;

  const GalleryActionButtons({
    super.key,
    required this.gallery,
    required this.parentContext,
    this.currentUserDid,
    this.onFavorite,
    this.onComment,
    this.onShare,
    this.isLoggedIn = true,
  });

  Future<void> _showShareDialog(BuildContext context, WidgetRef ref) async {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            ShareDialog(gallery: gallery, onComplete: () => Navigator.of(context).pop()),
        fullscreenDialog: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isFav = gallery.viewer != null && gallery.viewer?.fav != null;
    return isLoggedIn
        ? Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap:
                    onFavorite ??
                    () async {
                      await ref.read(galleryCacheProvider.notifier).toggleFavorite(gallery.uri);
                    },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                  child: Row(
                    children: [
                      FaIcon(
                        isFav ? AppIcons.solidHeart : AppIcons.heart,
                        color: isFav ? AppTheme.favoriteColor : theme.iconTheme.color,
                        size: 21,
                      ),
                      if (gallery.favCount != null) ...[
                        const SizedBox(width: 4),
                        Text(
                          gallery.favCount.toString(),
                          style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 18),
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap:
                    onComment ??
                    () {
                      Navigator.of(parentContext).push(
                        MaterialPageRoute(
                          builder: (context) => CommentsPage(galleryUri: gallery.uri),
                        ),
                      );
                    },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                  child: Row(
                    children: [
                      FaIcon(AppIcons.comment, color: theme.iconTheme.color, size: 21),
                      if (gallery.commentCount != null) ...[
                        const SizedBox(width: 4),
                        Text(
                          gallery.commentCount.toString(),
                          style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 18),
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap:
                    onShare ??
                    () async {
                      await _showShareDialog(context, ref);
                    },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                  child: FaIcon(
                    AppIcons.arrowUpFromBracket,
                    color: theme.iconTheme.color,
                    size: 18,
                  ),
                ),
              ),
            ],
          )
        : const SizedBox.shrink();
  }
}
