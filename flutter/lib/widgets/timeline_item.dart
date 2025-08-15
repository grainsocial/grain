import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/screens/hashtag_page.dart';
import 'package:grain/utils.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/faceted_text.dart';
import 'package:grain/widgets/gallery_action_buttons.dart';
import 'package:grain/widgets/gallery_preview.dart';
import 'package:url_launcher/url_launcher.dart';

import '../providers/gallery_cache_provider.dart';
import '../screens/gallery_page.dart';
import '../screens/profile_page.dart';

class TimelineItemWidget extends ConsumerWidget {
  final String galleryUri;
  final VoidCallback? onProfileTap;
  const TimelineItemWidget({super.key, required this.galleryUri, this.onProfileTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gallery = ref.watch(galleryCacheProvider)[galleryUri];
    if (gallery == null) {
      return const SizedBox.shrink();
    }
    final actor = gallery.creator;
    final createdAt = gallery.createdAt;
    final theme = Theme.of(context);
    final isLoggedIn = apiService.currentUser?.did != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          child: Row(
            children: [
              GestureDetector(
                onTap:
                    onProfileTap ??
                    () {
                      if (actor?.did != null) {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => ProfilePage(did: actor!.did, showAppBar: true),
                          ),
                        );
                      }
                    },
                child: CircleAvatar(
                  radius: 18,
                  backgroundColor: theme.scaffoldBackgroundColor,
                  child: (actor?.avatar?.isNotEmpty ?? false)
                      ? ClipOval(
                          child: AppImage(
                            url: actor!.avatar ?? '',
                            width: 36,
                            height: 36,
                            fit: BoxFit.cover,
                          ),
                        )
                      : Icon(
                          AppIcons.accountCircle,
                          size: 24,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: GestureDetector(
                        onTap:
                            onProfileTap ??
                            () {
                              if (actor?.did != null) {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) =>
                                        ProfilePage(did: actor!.did, showAppBar: true),
                                  ),
                                );
                              }
                            },
                        child: Text.rich(
                          TextSpan(
                            children: [
                              if (actor?.displayName?.isNotEmpty ?? false)
                                TextSpan(
                                  text: actor!.displayName ?? '',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                              if (actor != null && actor.handle.isNotEmpty)
                                TextSpan(
                                  text: (actor.displayName?.isNotEmpty ?? false)
                                      ? ' @${actor.handle}'
                                      : '@${actor.handle}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    fontSize: 14,
                                    color: theme.colorScheme.onSurfaceVariant,
                                    fontWeight: FontWeight.normal,
                                  ),
                                ),
                            ],
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ),
                    ),
                    Text(
                      formatRelativeTime(createdAt ?? ''),
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontSize: 14,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (gallery.items.isNotEmpty)
          GestureDetector(
            onTap: () {
              if (gallery.uri.isNotEmpty) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) =>
                        GalleryPage(uri: gallery.uri, currentUserDid: apiService.currentUser?.did),
                  ),
                );
              }
            },
            child: GalleryPreview(gallery: gallery),
          )
        else
          const SizedBox.shrink(),
        if (gallery.title?.isNotEmpty == true)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 8, right: 8),
            child: Text(
              gallery.title ?? '',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        if (gallery.description?.isNotEmpty == true)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 8, right: 8),
            child: FacetedText(
              text: gallery.description ?? '',
              facets: gallery.facets ?? [],
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              linkStyle: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
                fontWeight: FontWeight.w600,
              ),
              onMentionTap: (did) {
                Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (context) => ProfilePage(did: did)));
              },
              onTagTap: (tag) => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => HashtagPage(hashtag: tag)),
              ),
              onLinkTap: (url) async {
                final uri = Uri.parse(url);
                if (!await launchUrl(uri)) {
                  throw Exception('Could not launch $url');
                }
              },
            ),
          ),
        const SizedBox(height: 8),
        if (isLoggedIn)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: GalleryActionButtons(
              gallery: gallery,
              parentContext: context,
              currentUserDid: gallery.creator?.did ?? '',
              isLoggedIn: isLoggedIn,
            ),
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}
