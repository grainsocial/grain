import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:grain/api.dart';
import 'package:grain/app_icons.dart';
import 'package:grain/app_theme.dart';
import 'package:grain/models/profile_with_galleries.dart';
import 'package:grain/providers/notifications_provider.dart';
import 'package:grain/providers/profile_provider.dart';
import 'package:grain/widgets/app_image.dart';

class BottomNavBar extends ConsumerWidget {
  final int navIndex;
  final VoidCallback onHome;
  final VoidCallback onExplore;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  const BottomNavBar({
    super.key,
    required this.navIndex,
    required this.onHome,
    required this.onExplore,
    required this.onNotifications,
    required this.onProfile,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final did = apiService.currentUser?.did;
    final asyncProfile = did != null
        ? ref.watch(profileNotifierProvider(did))
        : const AsyncValue<ProfileWithGalleries?>.loading();

    final avatarUrl = asyncProfile.maybeWhen(
      data: (profileWithGalleries) => profileWithGalleries?.profile.avatar,
      orElse: () => null,
    );

    final theme = Theme.of(context);

    // Get unread notifications count
    final notifications = ref.watch(notificationsProvider);
    final unreadCount = notifications.maybeWhen(
      data: (list) => list.where((n) => n.isRead == false).length,
      orElse: () => 0,
    );

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor, width: 1)),
      ),
      height: 42 + MediaQuery.of(context).padding.bottom,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onHome,
              child: SizedBox(
                height: 42 + MediaQuery.of(context).padding.bottom,
                child: Transform.translate(
                  offset: const Offset(0, -10),
                  child: Center(
                    child: FaIcon(
                      AppIcons.house,
                      size: 20,
                      color: navIndex == 0
                          ? AppTheme.primaryColor
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onExplore,
              child: SizedBox(
                height: 42 + MediaQuery.of(context).padding.bottom,
                child: Transform.translate(
                  offset: const Offset(0, -10),
                  child: Center(
                    child: FaIcon(
                      AppIcons.magnifyingGlass,
                      size: 20,
                      color: navIndex == 1
                          ? AppTheme.primaryColor
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onNotifications,
              child: SizedBox(
                height: 42 + MediaQuery.of(context).padding.bottom,
                child: Transform.translate(
                  offset: const Offset(0, -10),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Center(
                        child: FaIcon(
                          AppIcons.solidBell,
                          size: 20,
                          color: navIndex == 2
                              ? AppTheme.primaryColor
                              : Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      if (unreadCount > 0)
                        Align(
                          alignment: Alignment.center,
                          child: Transform.translate(
                            offset: const Offset(10, -10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: theme.scaffoldBackgroundColor, width: 1),
                              ),
                              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                              child: Text(
                                unreadCount > 99 ? '99+' : unreadCount.toString(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                                textAlign: TextAlign.center,
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
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onProfile,
              child: SizedBox(
                height: 42 + MediaQuery.of(context).padding.bottom,
                child: Transform.translate(
                  offset: const Offset(0, -10),
                  child: Center(
                    child: avatarUrl != null && avatarUrl.isNotEmpty
                        ? Container(
                            width: 28,
                            height: 28,
                            alignment: Alignment.center,
                            decoration: navIndex == 3
                                ? BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppTheme.primaryColor, width: 2.2),
                                  )
                                : null,
                            child: ClipOval(
                              child: AppImage(
                                url: avatarUrl,
                                width: 24,
                                height: 24,
                                fit: BoxFit.cover,
                              ),
                            ),
                          )
                        : FaIcon(
                            navIndex == 3 ? AppIcons.solidUser : AppIcons.user,
                            size: 16,
                            color: navIndex == 3
                                ? AppTheme.primaryColor
                                : Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
