import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/app_theme.dart';
import 'package:grain/models/gallery.dart';
import 'package:grain/models/profile_with_galleries.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:grain/screens/hashtag_page.dart';
import 'package:grain/widgets/app_button.dart';
import 'package:grain/widgets/app_image.dart';
import 'package:grain/widgets/camera_pills.dart';
import 'package:grain/widgets/edit_profile_sheet.dart';
import 'package:grain/widgets/faceted_text.dart';
import 'package:url_launcher/url_launcher.dart';

import 'followers_page.dart';
import 'follows_page.dart';
import 'gallery_page.dart';

class ProfilePage extends ConsumerStatefulWidget {
  final dynamic profile;
  final String? did;
  final bool showAppBar;
  const ProfilePage({super.key, this.profile, this.did, this.showAppBar = false});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  int _selectedSection = 0; // 0 = Galleries, 1 = Favs

  // Refactored: Just pop the sheet after save, don't return edited values
  Future<void> _handleProfileSave(
    String did,
    String displayName,
    String description,
    dynamic avatarFile,
  ) async {
    final notifier = ref.read(profileNotifierProvider(did).notifier);
    final success = await notifier.updateProfile(
      displayName: displayName,
      description: description,
      avatarFile: avatarFile,
    );
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
      if (mounted) {
        setState(() {}); // Force widget rebuild after modal closes
      }
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to update profile')));
    }
  }

  void _showAvatarFullscreen(String avatarUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.95),
      builder: (context) {
        final size = MediaQuery.of(context).size;
        final diameter = size.width;
        return Stack(
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Center(
                child: Hero(
                  tag: 'profile-avatar',
                  child: ClipOval(
                    child: SizedBox(
                      width: diameter,
                      height: diameter,
                      child: AppImage(
                        url: avatarUrl,
                        fit: BoxFit.cover,
                        width: diameter,
                        height: diameter,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 40,
              right: 24,
              child: SafeArea(
                child: IconButton(
                  icon: Icon(AppIcons.closeRounded, color: Colors.white, size: 36),
                  onPressed: () => Navigator.of(context).pop(),
                  tooltip: 'Close',
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final did = widget.did ?? widget.profile?.did;
    final asyncProfile = did != null
        ? ref.watch(profileNotifierProvider(did))
        : const AsyncValue<ProfileWithGalleries?>.loading();

    Future<void> refreshProfile() async {
      if (did != null) {
        final _ = await ref.refresh(profileNotifierProvider(did).future);
        setState(() {});
      }
    }

    return asyncProfile.when(
      loading: () => Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: Center(
          child: CircularProgressIndicator(strokeWidth: 2, color: theme.colorScheme.primary),
        ),
      ),
      error: (err, stack) => Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: Center(child: Text('Failed to load profile')),
      ),
      data: (profileWithGalleries) {
        if (profileWithGalleries == null) {
          return Scaffold(
            backgroundColor: theme.scaffoldBackgroundColor,
            body: Center(child: Text('Profile not found')),
          );
        }
        final profile = profileWithGalleries.profile;
        final galleries = profileWithGalleries.galleries;
        final favs = profileWithGalleries.favs;

        return Scaffold(
          backgroundColor: theme.scaffoldBackgroundColor,
          appBar: widget.showAppBar
              ? AppBar(
                  backgroundColor: theme.appBarTheme.backgroundColor,
                  surfaceTintColor: theme.appBarTheme.backgroundColor,
                  leading: const BackButton(),
                )
              : null,
          body: SafeArea(
            bottom: false,
            child: RefreshIndicator(
              onRefresh: refreshProfile,
              child: SingleChildScrollView(
                padding: EdgeInsets.zero,
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Avatar
                              if (profile.avatar != null)
                                GestureDetector(
                                  onTap: () => _showAvatarFullscreen(profile.avatar!),
                                  child: ClipOval(
                                    child: AppImage(
                                      url: profile.avatar,
                                      width: 64,
                                      height: 64,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                )
                              else
                                Icon(AppIcons.accountCircle, size: 64, color: Colors.grey),
                              const Spacer(),
                              // Follow/Unfollow button
                              if (profile.did != apiService.currentUser?.did)
                                SizedBox(
                                  child: AppButton(
                                    size: AppButtonSize.small,
                                    variant: profile.viewer?.following?.isNotEmpty == true
                                        ? AppButtonVariant.secondary
                                        : AppButtonVariant.primary,
                                    onPressed: () async {
                                      await ref
                                          .read(profileNotifierProvider(profile.did).notifier)
                                          .toggleFollow(profile.did);
                                    },
                                    label: (profile.viewer?.following?.isNotEmpty == true)
                                        ? 'Following'
                                        : 'Follow',
                                  ),
                                )
                              // Edit Profile button for current user
                              else
                                SizedBox(
                                  child: AppButton(
                                    size: AppButtonSize.small,
                                    variant: AppButtonVariant.secondary,
                                    onPressed: () async {
                                      showEditProfileSheet(
                                        context,
                                        initialDisplayName: profile.displayName,
                                        initialDescription: profile.description,
                                        initialAvatarUrl: profile.avatar,
                                        onSave: (displayName, description, avatarFile) async {
                                          await _handleProfileSave(
                                            profile.did,
                                            displayName,
                                            description,
                                            avatarFile,
                                          );
                                        },
                                        onCancel: () {
                                          Navigator.of(context).maybePop();
                                        },
                                      );
                                    },
                                    label: 'Edit profile',
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            profile.displayName ?? '',
                            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                            textAlign: TextAlign.left,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '@${profile.handle}',
                            style: TextStyle(
                              fontSize: 14,
                              color: Theme.of(context).brightness == Brightness.dark
                                  ? Colors.grey[400]
                                  : Colors.grey[700],
                            ),
                            textAlign: TextAlign.left,
                          ),
                          const SizedBox(height: 12),
                          _ProfileStatsRow(
                            followers:
                                (profile.followersCount is int
                                        ? profile.followersCount
                                        : int.tryParse(profile.followersCount?.toString() ?? '0') ??
                                              0)
                                    .toString(),
                            following:
                                (profile.followsCount is int
                                        ? profile.followsCount
                                        : int.tryParse(profile.followsCount?.toString() ?? '0') ??
                                              0)
                                    .toString(),
                            galleries:
                                (profile.galleryCount is int
                                        ? profile.galleryCount
                                        : int.tryParse(profile.galleryCount?.toString() ?? '0') ??
                                              0)
                                    .toString(),
                            did: profile.did,
                          ),
                          if ((profile.cameras?.isNotEmpty ?? false)) ...[
                            const SizedBox(height: 16),
                            CameraPills(cameras: profile.cameras!),
                          ],
                          if ((profile.description ?? '').isNotEmpty) ...[
                            const SizedBox(height: 16),
                            FacetedText(
                              text: profile.description ?? '',
                              facets: profile.descriptionFacets,
                              onMentionTap: (didOrHandle) {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) =>
                                        ProfilePage(did: didOrHandle, showAppBar: true),
                                  ),
                                );
                              },
                              onLinkTap: (url) async {
                                final uri = Uri.parse(url);
                                if (!await launchUrl(uri)) {
                                  throw Exception('Could not launch $url');
                                }
                              },
                              onTagTap: (tag) => Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => HashtagPage(hashtag: tag)),
                              ),
                              linkStyle: TextStyle(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),
                          // REMOVE the Stack (tab row + divider) from inside Padding COMPLETELY
                          SizedBox(height: 12), // Add bottom padding before grid
                        ],
                      ),
                    ),
                    // Place Stack (tab row + divider) OUTSIDE Padding for true edge-to-edge
                    Stack(
                      children: [
                        Positioned.fill(
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            child: Container(height: 1, color: Theme.of(context).dividerColor),
                          ),
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: _ProfileTabButton(
                                label: 'Galleries',
                                selected: _selectedSection == 0,
                                onTap: () {
                                  setState(() => _selectedSection = 0);
                                },
                              ),
                            ),
                            if (apiService.currentUser?.did == profile.did)
                              Expanded(
                                child: _ProfileTabButton(
                                  label: 'Favs',
                                  selected: _selectedSection == 1,
                                  onTap: () {
                                    setState(() => _selectedSection = 1);
                                  },
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                    // SizedBox(height: 1), // Add bottom padding before grid
                    // Directly show the grid, not inside Expanded/NestedScrollView
                    _selectedSection == 0
                        ? _buildGalleryGrid(theme, galleries)
                        : _buildFavsGrid(theme, favs),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildGalleryGrid(ThemeData theme, List<Gallery> galleries) {
    if (galleries.isEmpty) {
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 3 / 4,
          crossAxisSpacing: 2,
          mainAxisSpacing: 2,
        ),
        itemCount: 12,
        itemBuilder: (context, index) {
          return Container(color: theme.colorScheme.surfaceContainerHighest);
        },
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 3 / 4,
        crossAxisSpacing: 2,
        mainAxisSpacing: 2,
      ),
      itemCount: (galleries.length < 12 ? 12 : galleries.length),
      itemBuilder: (context, index) {
        if (galleries.isNotEmpty && index < galleries.length) {
          final gallery = galleries[index];
          final hasPhoto =
              gallery.items.isNotEmpty && (gallery.items[0].thumb?.isNotEmpty ?? false);
          return GestureDetector(
            onTap: () {
              if (gallery.uri.isNotEmpty) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => GalleryPage(
                      uri: gallery.uri,
                      currentUserDid: apiService.currentUser?.did ?? '',
                    ),
                  ),
                );
              }
            },
            child: Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
              ),
              clipBehavior: Clip.antiAlias,
              child: hasPhoto
                  ? AppImage(url: gallery.items[0].thumb, fit: BoxFit.cover)
                  : Center(
                      child: Text(
                        gallery.title ?? '',
                        style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                    ),
            ),
          );
        }
        return Container(color: theme.colorScheme.surfaceContainerHighest);
      },
    );
  }

  Widget _buildFavsGrid(ThemeData theme, List<Gallery>? favs) {
    // Handle null favs more defensively
    final safeList = favs ?? [];
    final itemCount = safeList.length < 12 ? 12 : safeList.length;
    if (safeList.isEmpty) {
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 3 / 4,
          crossAxisSpacing: 2,
          mainAxisSpacing: 2,
        ),
        itemCount: 12,
        itemBuilder: (context, index) {
          return Container(color: theme.colorScheme.surfaceContainerHighest);
        },
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 3 / 4,
        crossAxisSpacing: 2,
        mainAxisSpacing: 2,
      ),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        if (safeList.isNotEmpty && index < safeList.length) {
          final gallery = safeList[index];
          final hasPhoto =
              gallery.items.isNotEmpty && (gallery.items[0].thumb?.isNotEmpty ?? false);
          return GestureDetector(
            onTap: () {
              if (gallery.uri.isNotEmpty) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => GalleryPage(
                      uri: gallery.uri,
                      currentUserDid: apiService.currentUser?.did ?? '',
                    ),
                  ),
                );
              }
            },
            child: Container(
              decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest),
              clipBehavior: Clip.antiAlias,
              child: hasPhoto
                  ? AppImage(url: gallery.items[0].thumb, fit: BoxFit.cover)
                  : Center(
                      child: Text(
                        gallery.title ?? '',
                        style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                    ),
            ),
          );
        }
        return Container(color: theme.colorScheme.surfaceContainerHighest);
      },
    );
  }
}

class _ProfileStatsRow extends StatelessWidget {
  final String followers;
  final String following;
  final String galleries;
  final String did;
  const _ProfileStatsRow({
    required this.followers,
    required this.following,
    required this.galleries,
    required this.did,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final styleCount = const TextStyle(
      fontWeight: FontWeight.bold,
      fontSize: 14, // Set to 14
    );
    final styleLabel = TextStyle(
      color: theme.brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[700],
      fontSize: 14, // Set to 14
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () {
            Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => FollowersPage(actorDid: did)));
          },
          child: Row(
            children: [
              Text(followers, style: styleCount),
              const SizedBox(width: 4),
              Text('followers', style: styleLabel),
            ],
          ),
        ),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: () {
            Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => FollowsPage(actorDid: did)));
          },
          child: Row(
            children: [
              Text(following, style: styleCount),
              const SizedBox(width: 4),
              Text('following', style: styleLabel),
            ],
          ),
        ),
        const SizedBox(width: 16),
        Text(galleries, style: styleCount),
        const SizedBox(width: 4),
        Text('galleries', style: styleLabel),
      ],
    );
  }
}

class _ProfileTabButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ProfileTabButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 44,
        alignment: Alignment.center,
        child: Stack(
          alignment: Alignment.bottomCenter,
          children: [
            Center(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                  color: selected
                      ? theme.colorScheme.onSurface
                      : theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            if (selected)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    height: 3,
                    width: _textWidth(context, label),
                    color: AppTheme.primaryColor,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  double _textWidth(BuildContext context, String text) {
    final TextPainter textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
      maxLines: 1,
      textDirection: TextDirection.ltr,
    )..layout();
    return textPainter.width;
  }
}
